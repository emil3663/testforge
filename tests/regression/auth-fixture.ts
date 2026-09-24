import { createServer, type Server } from "node:http";

// Phase 20: a small real site with a real cookie login, for exercising
// authenticated runs. Test-only values - never real credentials. They are
// handed to the TestForge server under test through playwright.regression.
// config.ts's webServer.env (the only way a credential reaches TestForge is
// an environment variable), and read here by the specs that need to know
// what the right and wrong values are.
export const AUTH_FIXTURE_PORT = 4397;
export const AUTH_FIXTURE_URL = `http://127.0.0.1:${AUTH_FIXTURE_PORT}`;

export const AUTH_FIXTURE_USER_ENV = "TESTFORGE_TEST_LOGIN_USER";
export const AUTH_FIXTURE_PASS_ENV = "TESTFORGE_TEST_LOGIN_PASS";
export const AUTH_FIXTURE_WRONG_PASS_ENV = "TESTFORGE_TEST_LOGIN_WRONG_PASS";

export const AUTH_FIXTURE_USER = "fixture-user";
export const AUTH_FIXTURE_PASS = "Fixture-Pass-7391-zq";
export const AUTH_FIXTURE_WRONG_PASS = "definitely-not-the-password";

export const AUTH_FIXTURE_ENV = {
    [AUTH_FIXTURE_USER_ENV]: AUTH_FIXTURE_USER,
    [AUTH_FIXTURE_PASS_ENV]: AUTH_FIXTURE_PASS,
    [AUTH_FIXTURE_WRONG_PASS_ENV]: AUTH_FIXTURE_WRONG_PASS,
};

// The session token the fixture issues. Specs also grep for it: it must not
// leak into anything TestForge hands back either (TFP-094).
export const AUTH_FIXTURE_SESSION = `fixture-session-${Math.random().toString(36).slice(2)}-${Date.now()}`;

// Like the real target the-internet.herokuapp.com (a Rack app): a session is
// only honored for the User-Agent and Accept-Language it was issued to. Found live while building
// TFP-092 - a login driven with Playwright's default UA produced a session the
// tests, running as Desktop Chrome, were then refused. Recorded per server
// start, at the moment of a successful login.
let sessionUserAgent: string | null = null;
let sessionAcceptLanguage: string | null = null;

// What the login request that established the session actually looked like,
// so a spec can assert the login and the tests share one browser context
// rather than relying on this machine's locale happening to differ.
export function loginRequestIdentity() {
    return { userAgent: sessionUserAgent, acceptLanguage: sessionAcceptLanguage };
}

function page(body: string) {
    return `<!doctype html><html><head><title>Auth fixture</title></head><body>${body}</body></html>`;
}

export function startAuthFixture(): Promise<Server> {
    const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", AUTH_FIXTURE_URL);
        const signedIn =
            (req.headers.cookie ?? "").split(/;\s*/).includes(`fixture_session=${AUTH_FIXTURE_SESSION}`) &&
            req.headers["user-agent"] === sessionUserAgent &&
            req.headers["accept-language"] === sessionAcceptLanguage;

        if (url.pathname === "/login" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => { body += chunk; });
            req.on("end", () => {
                const form = new URLSearchParams(body);
                const ok = form.get("username") === AUTH_FIXTURE_USER && form.get("password") === AUTH_FIXTURE_PASS;

                if (ok) {
                    sessionUserAgent = req.headers["user-agent"] ?? null;
                    sessionAcceptLanguage = req.headers["accept-language"] ?? null;
                }

                res.writeHead(302, {
                    Location: ok ? "/secure" : "/login?error=1",
                    ...(ok ? { "Set-Cookie": `fixture_session=${AUTH_FIXTURE_SESSION}; Path=/; HttpOnly` } : {}),
                });
                res.end();
            });
            return;
        }

        req.resume();
        res.setHeader("Content-Type", "text/html");

        if (url.pathname === "/login") {
            res.end(page(`<h1>Sign in</h1>${url.searchParams.get("error") ? '<p id="error">Invalid credentials</p>' : ""}
                <form method="post" action="/login">
                    <input id="username" name="username" type="text">
                    <input id="password" name="password" type="password">
                    <button id="submit" type="submit">Sign in</button>
                </form>`));
            return;
        }

        if (url.pathname === "/secure" || url.pathname === "/account") {
            if (!signedIn) {
                res.writeHead(302, { Location: "/login" });
                res.end();
                return;
            }

            res.end(page(`<h1>${url.pathname === "/secure" ? "Secure area" : "Your account"}</h1><button id="logout">Log out</button>`));
            return;
        }

        res.end(page("<h1>Public home</h1><a href=\"/login\">Sign in</a>"));
    });

    return new Promise((resolve) => server.listen(AUTH_FIXTURE_PORT, "127.0.0.1", () => resolve(server)));
}
