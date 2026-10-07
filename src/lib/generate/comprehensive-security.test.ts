/**
 * Phase 35 (TFP-133, Decision 3): Comprehensive security at the passive
 * level - its checks, their standards tags, the one-worker rule held by the
 * suite itself, and the request-recording test: nothing is sent but page
 * loads and one missing-page probe.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/comprehensive-security.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { JsonReport } from "../report/types.ts";

const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { ASVS_CHAPTERS } = await import("../comprehensive/asvs.ts");
const { TOP10_2025 } = await import("../comprehensive/standards.ts");
const { findTypeErrors, findUnawaitedAssertions, findPromisesToPlainMatchers, findDuplicateTests } = await import("./validate.ts");
const { flattenSuites } = await import("../report/execution.ts");

const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const SECURITY = normalizeRunMode({ kind: "comprehensive", area: "security" }) as ComprehensiveRunMode;

function suiteFor(origin: string, pages: string[]) {
    return buildComprehensiveSuite(origin, SECURITY, { covered: pages, notCovered: [], pageCap: 20 });
}

// --- the suite as written ----------------------------------------------------

test("the suite type-checks, passes every model gate, and runs one test at a time by itself", () => {
    const code = suiteFor("https://site.test", ["/", "/login"]);
    assert.deepEqual(findTypeErrors(code), []);
    assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), []);
    assert.deepEqual(findPromisesToPlainMatchers(code), []);
    assert.deepEqual(findDuplicateTests(code), []);
    assert.equal(code.match(/test\.describe\.configure\(\{ mode: 'default' \}\);/g)?.length, 1, "one file-level configure");
    assert.equal(code.match(/^test\.describe\.configure/m)?.index !== undefined, true, "at the top level, so it covers every test");
});

test("the suite sends no input: no typing, clicking, submitting or non-GET request, and exactly one direct request", () => {
    const code = suiteFor("https://site.test", ["/", "/login", "/notes"]);
    assert.doesNotMatch(code, /\.(fill|type|press|click|dblclick|check|uncheck|selectOption|setInputFiles|dispatchEvent|tap|submit)\(|request\.(post|put|patch|delete|fetch|head)\(|\bfetch\(/);
    assert.equal(code.match(/request\.get\(/g)?.length, 1, "the missing-page probe, once per run");
    // TFP-167: every page load goes through tfGoto, whose own body holds the only page.goto calls.
    assert.equal(code.match(/tfGoto\(page, /g)?.length, 3 * 4, "four page loads per page");
});

test("every check carries an OWASP Top 10:2025 category and ASVS 5.0 requirements from chapters in a passive run's reach", () => {
    const code = suiteFor("https://site.test", ["/"]);
    const tests = [...code.matchAll(/test\('(TFSC-\d{3}: [^']*)', \{ annotation: \[(.*?)\] \}/g)];
    assert.equal(tests.length, 5);
    const categories = new Set<string>(Object.values(TOP10_2025));
    const inReach = new Set(ASVS_CHAPTERS.filter((chapter) => chapter.passiveReach === "in reach").map((chapter) => chapter.id));
    for (const [, title, annotations] of tests) {
        const category = /type: 'category', description: '([^']+)'/.exec(annotations)?.[1];
        assert.ok(category && categories.has(category), `${title}: category ${category}`);
        const asvs = [...annotations.matchAll(/type: 'asvs', description: '([\d.]+)'/g)].map((m) => m[1]);
        assert.ok(asvs.length > 0, `${title}: has ASVS requirements`);
        for (const id of asvs) assert.ok(inReach.has(`V${id.split(".")[0]}`), `${title}: ASVS ${id} is in a passive run's reach`);
    }
    assert.deepEqual(tests.map(([, , annotations]) => /type: 'category', description: '([^']+)'/.exec(annotations)![1]), [
        "A02:2025 Security Misconfiguration",
        "A01:2025 Broken Access Control",
        "A04:2025 Cryptographic Failures",
        "A06:2025 Insecure Design",
        "A10:2025 Mishandling of Exceptional Conditions",
    ]);
});

// --- each check, in a real browser, on routed sites --------------------------

interface Fake {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
}

interface Outcome {
    title: string;
    passed: boolean;
    /** Set when the test skipped itself, with its reason (a page answering 400 or above). */
    skipped?: string;
    message: string;
    findings: string[];
}

class Skipped extends Error {}

/**
 * Runs a generated suite's page tests the way Playwright would, against
 * routed sites: every request is answered from `site` (by full URL), so a
 * page can really be https:// or plain http:// with exact headers. The
 * missing-page probe needs a real server; the CLI test below runs it.
 */
async function runPageTests(code: string, site: Record<string, Fake>): Promise<Outcome[]> {
    const ts = await import("typescript");
    const { chromium, expect } = await import("@playwright/test");
    const js = ts.transpileModule(code.replace(/^import .*$/m, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const collected: { title: string; fn: (fixtures: unknown) => Promise<void> }[] = [];
    let annotations: { type: string; description?: string }[] = [];
    const fakeTest = Object.assign(
        (title: string, _details: unknown, fn: (fixtures: unknown) => Promise<void>) => { collected.push({ title, fn }); },
        {
            use: () => {},
            info: () => ({ annotations }),
            skip: (condition: boolean, reason: string) => {
                if (condition) throw new Skipped(reason);
            },
            describe: Object.assign((_title: string, fn: () => void) => fn(), { configure: () => {} }),
        }
    );
    new Function("test", "expect", js)(fakeTest, expect);

    const browser = await chromium.launch();
    const outcomes: Outcome[] = [];
    try {
        for (const { title, fn } of collected.filter((entry) => !/cannot exist/.test(entry.title))) {
            const context = await browser.newContext({ baseURL: Object.keys(site)[0] });
            await context.route("**/*", (route) => {
                const fake = site[route.request().url()];
                return fake ? route.fulfill({ status: fake.status ?? 200, headers: { "content-type": "text/html", ...(fake.headers ?? {}) }, body: fake.body ?? "" }) : route.fulfill({ status: 404, body: "" });
            });
            const page = await context.newPage();
            annotations = [];
            try {
                await fn({ page, context, request: context.request });
                outcomes.push({ title, passed: true, message: "", findings: annotations.filter((a) => a.type === "finding").map((a) => a.description!) });
            } catch (error) {
                if (error instanceof Skipped) outcomes.push({ title, passed: true, skipped: error.message, message: "", findings: [] });
                else outcomes.push({ title, passed: false, message: (error as Error).message, findings: annotations.filter((a) => a.type === "finding").map((a) => a.description!) });
            } finally {
                await context.close();
            }
        }
    } finally {
        await browser.close();
    }
    return outcomes;
}

const HTML = (body: string) => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
const HARDENED_HEADERS = {
    "content-security-policy": "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    server: "nginx",
    "set-cookie": "sid=abc; Path=/; Secure; HttpOnly",
};

test("in a real browser: a hardened HTTPS site passes every passive check with no findings", { skip: needsChromium }, async () => {
    const outcomes = await runPageTests(suiteFor("https://secure.site.test", ["/login"]), {
        "https://secure.site.test/login": { headers: HARDENED_HEADERS, body: HTML(`<form method="post" action="/session"><input type="password" name="password"></form><a href="/help?page=2">Help</a>`) },
    });
    assert.deepEqual(outcomes.map((o) => [o.passed, o.findings]), [[true, []], [true, []], [true, []], [true, []]], JSON.stringify(outcomes, null, 1));
});

test("in a real browser: every hardening gap on an HTTPS site is a named finding, not a failure", { skip: needsChromium }, async () => {
    const outcomes = await runPageTests(suiteFor("https://bare.site.test", ["/"]), {
        "https://bare.site.test/": {
            headers: { server: "Apache/2.4.1", "x-powered-by": "PHP/8.1.2", "x-frame-options": "DENY", "content-security-policy": "default-src 'self'", "strict-transport-security": "max-age=600", "set-cookie": "session=abc; Path=/; Max-Age=34560000" },
            body: HTML(`<img src="http://cdn.site.test/logo.png" alt="logo">`),
        },
    });
    assert.ok(outcomes.every((o) => o.passed), JSON.stringify(outcomes, null, 1));
    assert.deepEqual(outcomes.flatMap((o) => o.findings), [
        "the Content-Security-Policy on / lacks object-src 'none'",
        "the Content-Security-Policy on / lacks base-uri 'none'",
        "/ relies on the obsolete X-Frame-Options; its Content-Security-Policy has no frame-ancestors",
        "no X-Content-Type-Options: nosniff on /",
        "no referrer policy on / (no Referrer-Policy header or meta referrer)",
        "Strict-Transport-Security on / lasts 600 seconds, under a year",
        'session cookie "session" set on / has no Secure attribute',
        'session cookie "session" set on / has no HttpOnly attribute, so page scripts can read it',
        'session cookie "session" set on / stays valid for 400 days, more than 30 (A07:2025 Authentication Failures, CWE-613)',
        "server: Apache/2.4.1 on / names a software version",
        "x-powered-by: PHP/8.1.2 on / names a software version",
        "/ is served over HTTPS but loads http://cdn.site.test/logo.png over plain HTTP (mixed content)",
    ]);
});

test("in a real browser: each exposure fails, naming the page and the element", { skip: needsChromium }, async () => {
    const plain = await runPageTests(suiteFor("http://plain.site.test", ["/login"]), {
        "http://plain.site.test/login": { body: HTML(`<form method="post" action="/session"><input type="password" id="pw"></form>`) },
    });
    assert.equal(plain[2].passed, false);
    assert.match(plain[2].message, /\/login is served over plain HTTP and has a password field \(pw\)/);

    const httpForm = await runPageTests(suiteFor("https://secure.site.test", ["/login"]), {
        "https://secure.site.test/login": { headers: HARDENED_HEADERS, body: HTML(`<form method="post" action="http://auth.site.test/session"><input type="password" name="password"></form>`) },
    });
    assert.equal(httpForm[2].passed, false);
    assert.match(httpForm[2].message, /a form on \/login sends a password field to the plain-HTTP address http:\/\/auth\.site\.test\/session/);

    const secrets = await runPageTests(suiteFor("https://secure.site.test", ["/"]), {
        "https://secure.site.test/": { headers: HARDENED_HEADERS, body: HTML(`<a href="/notes?sessionid=abc123">Notes</a><form action="/sign-in"><input type="password" name="password"></form>`) },
    });
    assert.equal(secrets[3].passed, false);
    assert.match(secrets[3].message, /a link on \/ to https:\/\/secure\.site\.test\/notes\?sessionid=abc123 carries sessionid in its URL/);
    assert.match(secrets[3].message, /a form on \/ would send its password field in the URL \(method GET, to https:\/\/secure\.site\.test\/sign-in\)/);
});

// TFP-136, found on the-internet: /basic_auth answers 401, which is the
// server working, not an exposure - so not a failure.
test("in a real browser: a page behind a login (401) is not run, with why; its response headers are still read for a version", { skip: needsChromium }, async () => {
    const outcomes = await runPageTests(suiteFor("https://secure.site.test", ["/basic_auth"]), {
        "https://secure.site.test/basic_auth": { status: 401, headers: { "www-authenticate": 'Basic realm="x"', server: "nginx/1.2.3" }, body: "Not authorized" },
    });
    const reason = "/basic_auth answered HTTP 401: it is behind a login, and this run does not sign in";
    assert.deepEqual(outcomes.map((o) => [o.passed, o.skipped ?? null]), [[true, reason], [true, null], [true, reason], [true, reason]]);
    assert.deepEqual(outcomes[1].findings, ["server: nginx/1.2.3 on /basic_auth names a software version"]);
});

test("in a real browser: a plain-HTTP password page on a local development host is not an exposure", { skip: needsChromium }, async () => {
    const outcomes = await runPageTests(suiteFor("http://localhost:3999", ["/login"]), {
        "http://localhost:3999/login": { body: HTML(`<form method="post" action="/session"><input type="password" name="password"></form>`) },
    });
    assert.equal(outcomes[2].passed, true, "localhost is a secure context, as browsers define it");
});

// --- the whole suite through the Playwright CLI: what it sends ---------------

interface Recorded {
    method: string;
    path: string;
    bodyBytes: number;
}

async function runWithPlaywright(code: string, extraArgs: string[]): Promise<JsonReport> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `passive-security-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", ...extraArgs], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport;
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

async function withRecordingSite(errorBody: string, run: (origin: string, recorded: Recorded[], maxInFlight: () => number) => Promise<void>, redirects: Record<string, string> = {}) {
    return withSite(errorBody, redirects, run);
}

async function withSite(errorBody: string, redirects: Record<string, string>, run: (origin: string, recorded: Recorded[], maxInFlight: () => number) => Promise<void>) {
    const recorded: Recorded[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const pages: Record<string, string> = {
        "/": HTML(`<a href="/login">Sign in</a> <a href="/notes">Notes</a>`),
        "/login": HTML(`<form method="post" action="/login"><input name="email"><input type="password" name="password"><button>Sign in</button></form>`),
        "/home": HTML(`<h1>Home</h1>`),
        "/notes": HTML(`<form method="post" action="/notes"><input name="note"><button>Save</button></form>`),
    };
    const server = createServer((req, res) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        let bodyBytes = 0;
        req.on("data", (chunk: Buffer) => (bodyBytes += chunk.length));
        req.on("end", () => {
            const path = new URL(req.url ?? "/", "http://x").pathname;
            recorded.push({ method: req.method ?? "", path, bodyBytes });
            if (redirects[path]) {
                inFlight--;
                res.writeHead(302, { location: redirects[path] }).end();
                return;
            }
            // A short hold, so overlapping tests would overlap here too.
            setTimeout(() => {
                inFlight--;
                if (pages[path]) res.writeHead(200, { "content-type": "text/html" }).end(pages[path]);
                else res.writeHead(404, { "content-type": "text/html" }).end(errorBody);
            }, 30);
        });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, recorded, () => maxInFlight);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

test("request recording: the passive run sends only GET page loads and one missing-page probe, one at a time, even when told to run in parallel", { skip: needsChromium }, async () => {
    await withRecordingSite(HTML("<h1>Not found</h1>"), async (origin, recorded, maxInFlight) => {
        const code = suiteFor(origin, ["/", "/login", "/notes"]);
        const json = await runWithPlaywright(code, ["--workers=4", "--fully-parallel"]);

        assert.deepEqual([...new Set(recorded.map((r) => r.method))], ["GET"], "every request is a GET");
        assert.ok(recorded.every((r) => r.bodyBytes === 0), "no request carries a body");
        const probes = recorded.filter((r) => r.path.startsWith("/testforge-missing-"));
        assert.equal(probes.length, 1, "exactly one missing-page probe");
        const others = recorded.filter((r) => !r.path.startsWith("/testforge-missing-"));
        assert.deepEqual([...new Set(others.map((r) => r.path))].sort(), ["/", "/favicon.ico", "/login", "/notes"].filter((p) => p !== "/favicon.ico" || others.some((r) => r.path === p)).sort(), "only the covered pages (and the browser's own favicon request) are loaded");
        assert.equal(others.filter((r) => r.path !== "/favicon.ico").length, 3 * 4, "four loads per page");
        assert.equal(maxInFlight(), 1, "never two requests at once");

        const results = (json.suites ?? []).length > 0 ? flattenSuites(json.suites) : [];
        assert.equal(results.length, 13);
        assert.ok(results.every((r) => r.status === "Passed"), JSON.stringify(results.filter((r) => r.status !== "Passed").map((r) => [r.title, r.rawMessage])));
        const parallelIndexes = new Set(JSON.stringify(json).match(/"parallelIndex":\s*\d+/g));
        assert.deepEqual([...parallelIndexes].map((s) => s.replace(/\s/g, "")), ['"parallelIndex":0'], "one worker slot, despite --workers=4 --fully-parallel");
    });
});

test("request recording: an error page that shows a stack trace and a server path fails the probe, naming both", { skip: needsChromium }, async () => {
    const trace = "<pre>Error: not found\n    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)\n    at next (/app/server.js:12:3)</pre>";
    await withRecordingSite(HTML(trace), async (origin) => {
        const json = await runWithPlaywright(suiteFor(origin, ["/"]), ["--workers=1"]);
        const probe = flattenSuites(json.suites ?? []).find((r) => /cannot exist/.test(r.title))!;
        assert.equal(probe.status, "Failed");
        assert.equal(probe.page, "(missing-page probe)");
        assert.equal(probe.category, "A10:2025 Mishandling of Exceptional Conditions");
        assert.deepEqual(probe.asvs, ["16.5.1"]);
        assert.match(probe.rawMessage, /\(HTTP 404\) shows a JavaScript stack trace .*; a server file path \("\/app\/node_modules\/express\/lib\/router\/layer\.js"\)/);
    });
});

test("request recording: a redirect through a URL carrying a session token fails, naming the URL", { skip: needsChromium }, async () => {
    await withRecordingSite(HTML("<h1>Not found</h1>"), async (origin) => {
        const json = await runWithPlaywright(suiteFor(origin, ["/"]), ["--workers=1"]);
        const secrets = flattenSuites(json.suites ?? []).find((r) => /no password or session token in a URL/.test(r.title))!;
        assert.equal(secrets.status, "Failed");
        const expected = `loading / went through ${origin}/home?token=xyz, which carries token in the URL`;
        assert.ok(secrets.rawMessage.includes(expected), secrets.rawMessage);
    }, { "/": "/home?token=xyz" });
});
