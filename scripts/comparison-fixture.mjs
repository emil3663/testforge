// Phase 21 (TFP-099): a small, real site with one switchable, injected defect
// per best-practice area, so the generator comparison can score
// defect-detection honestly: a generator "detects" a defect when one of its
// tests passes against the clean site and fails once that defect is switched
// on. Everything else about the site stays identical between the two runs.
//
//   node scripts/comparison-fixture.mjs [--port 4410]
//
// Control (never linked from the site, so introspection never finds it):
//   GET /__fixture/defect?set=<name>   switch one defect on ("none" = clean)
//   GET /__fixture/defect              the active defect
//   GET /__fixture/reset               clean site, no saved notes
import { createServer } from "node:http";

export const DEFECTS = {
    none: "clean site",
    "seo-missing-meta": "the home page has no meta description",
    "a11y-unlabelled-field": "the sign-in email field loses its label",
    "database-notes-not-saved": "a saved note is shown once but is gone after a reload",
    "performance-slow": "every page responds 4 seconds late",
    "reliability-api-crash": "the home page throws an uncaught error when /api/status fails",
    "security-unescaped-note": "a saved note is rendered as raw HTML, so markup in it runs",
    // Phase 35 (TFP-133): passive-security defects. Each is visible to a run
    // that only loads pages; the clean site's responses are unchanged.
    // (A password field on a plain-HTTP page can't be injected here: the
    // fixture is on loopback, which browsers treat as a secure context.
    // Reach the clean fixture by a non-loopback name such as
    // http://localtest.me:4410 to see that failure.)
    "security-password-to-http": "the sign-in form sends the password to a plain-HTTP address on another host",
    "security-token-in-url": "the home page links to the notes with a session id in the URL",
    "security-stack-trace": "a page that does not exist answers with a stack trace and server file paths",
    "security-version-header": "every response names the server software and its version (X-Powered-By)",
    "security-weak-session-cookie": "the home page sets a session cookie without HttpOnly that lasts 400 days",
};

const portArg = process.argv.indexOf("--port");
const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 4410;

let defect = "none";
let notes = [];
let flashOnce = null; // database-notes-not-saved: a note shown on one load only

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(title, body, { meta = true, script = "" } = {}) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} - Acme Notes</title>
${meta ? `<meta name="description" content="${title}: keep short notes with Acme Notes.">` : ""}
</head>
<body>
<nav><a href="/">Home</a> <a href="/login">Sign in</a> <a href="/notes">Notes</a></nav>
<main>
${body}
</main>
${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

function home() {
    // The page calls its own API. Clean: a failed call shows a message.
    // Defect: the failure is not caught, so it surfaces as a page error.
    const script =
        defect === "reliability-api-crash"
            ? `fetch('/api/status').then((r) => r.json()).then((s) => { document.getElementById('status').textContent = s.message; });`
            : `fetch('/api/status').then((r) => r.json()).then((s) => { document.getElementById('status').textContent = s.message; }).catch(() => { document.getElementById('status').textContent = 'Status unavailable'; });`;
    const crashScript =
        defect === "reliability-api-crash"
            ? `${script}\nwindow.addEventListener('unhandledrejection', (e) => { throw e.reason; });`
            : script;
    return page(
        "Home",
        `<h1>Acme Notes</h1>
<p>Write short notes and find them again later.</p>
<p id="status">Checking status...</p>
<p><a href="${defect === "security-token-in-url" ? "/notes?sessionid=4f9c2a1e7b" : "/notes"}">Go to your notes</a></p>`,
        { meta: defect !== "seo-missing-meta", script: crashScript }
    );
}

function login(error = "") {
    const emailField =
        defect === "a11y-unlabelled-field"
            ? `<span>Email</span> <input id="email" name="email" type="email">`
            : `<label for="email">Email</label> <input id="email" name="email" type="email">`;
    return page(
        "Sign in",
        `<h1>Sign in</h1>
<form method="post" action="${defect === "security-password-to-http" ? "http://login.acme-notes.invalid/session" : "/login"}">
<p>${emailField}</p>
<p><label for="password">Password</label> <input id="password" name="password" type="password"></p>
${error ? `<p role="alert">${escapeHtml(error)}</p>` : ""}
<p><button type="submit">Sign in</button></p>
</form>`
    );
}

function notesPage() {
    const shown = flashOnce ? [...notes, flashOnce] : notes;
    flashOnce = null;
    const items = shown
        .map((n) => `<li>${defect === "security-unescaped-note" ? n : escapeHtml(n)}</li>`)
        .join("\n");
    return page(
        "Notes",
        `<h1>Notes</h1>
<form method="post" action="/notes">
<p><label for="note">Note</label> <input id="note" name="note"></p>
<p><button type="submit">Save note</button></p>
</form>
<ul id="saved-notes">
${items}
</ul>`
    );
}

function readForm(req) {
    return new Promise((resolve) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => resolve(Object.fromEntries(new URLSearchParams(raw))));
    });
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const send = (status, body, type = "text/html; charset=utf-8", headers = {}) => {
        const defectHeaders = defect === "security-version-header" ? { "x-powered-by": "Express/4.18.2" } : {};
        res.writeHead(status, { "content-type": type, ...defectHeaders, ...headers }).end(body);
    };

    if (url.pathname === "/__fixture/defect") {
        const wanted = url.searchParams.get("set");
        if (wanted !== null) {
            if (!(wanted in DEFECTS)) return send(400, JSON.stringify({ error: `unknown defect ${wanted}`, defects: Object.keys(DEFECTS) }), "application/json");
            defect = wanted;
        }
        return send(200, JSON.stringify({ defect, description: DEFECTS[defect] }), "application/json");
    }
    if (url.pathname === "/__fixture/reset") {
        defect = "none";
        notes = [];
        flashOnce = null;
        return send(200, JSON.stringify({ defect }), "application/json");
    }

    if (defect === "performance-slow") await new Promise((r) => setTimeout(r, 4000));

    if (url.pathname === "/api/status") return send(200, JSON.stringify({ message: "All systems normal" }), "application/json");
    if (url.pathname === "/" && req.method === "GET") {
        const cookie = defect === "security-weak-session-cookie" ? { "set-cookie": "sid=acme-4f9c2a1e7b; Path=/; Max-Age=34560000" } : {};
        return send(200, home(), undefined, cookie);
    }
    if (url.pathname === "/login" && req.method === "GET") return send(200, login());
    if (url.pathname === "/login" && req.method === "POST") {
        const form = await readForm(req);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email ?? "")) return send(200, login("Enter a valid email address."));
        return send(303, "", "text/plain", { location: "/notes" });
    }
    if (url.pathname === "/notes" && req.method === "GET") return send(200, notesPage());
    if (url.pathname === "/notes" && req.method === "POST") {
        const form = await readForm(req);
        const note = (form.note ?? "").trim();
        if (note) {
            if (defect === "database-notes-not-saved") {
                // Shown on the next page load only, never stored. Same
                // redirect as the clean path: answering the POST directly
                // made page.reload() re-submit the form and "save" it again,
                // so the defect was invisible (found live, 2026-09-24).
                flashOnce = note;
            } else {
                notes.push(note);
            }
        }
        return send(303, "", "text/plain", { location: "/notes" });
    }
    if (defect === "security-stack-trace") {
        return send(404, page("Not found", `<h1>Not found</h1>
<pre>Error: ENOENT: no such file or directory, open '/srv/acme-notes/views${escapeHtml(url.pathname)}.html'
    at Object.openSync (node:fs:573:18)
    at renderView (/srv/acme-notes/server/render.js:41:17)</pre>`));
    }
    send(404, page("Not found", "<h1>Not found</h1>"));
});

server.listen(port, "127.0.0.1", () => {
    console.log(`comparison fixture on http://127.0.0.1:${port} (defects: ${Object.keys(DEFECTS).join(", ")})`);
});
