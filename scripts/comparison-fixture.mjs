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
    // TFP-144: one session cookie and two that are not, none with HttpOnly.
    // The Standard and passive-security checks must name the same one: sid.
    "security-mixed-cookies": "the home page sets a session cookie and two analytics-style cookies, none with HttpOnly",
    // Phase 35 (TFP-134): WCAG defects for the axe-core scan, beside
    // a11y-unlabelled-field above. The clean site's responses are unchanged.
    "a11y-missing-alt": "the home page shows an image with no alternative text",
    "a11y-low-contrast": "the home page's introduction is light grey on white",
    // Phase 38 (TFP-148): not a defect, a case axe cannot decide. Text over a
    // background image leaves colour contrast "incomplete", so the scan
    // lists it for manual review and still passes.
    "a11y-text-over-image": "the home page's introduction is white text over a background image",
    // TFP-159: not defects, menus that hide links. The home page gains a site
    // nav that collapses under 600 px behind a toggle (aria-controls), holding
    // a "Categories" dropdown whose button has no aria-controls (Bootstrap's
    // sibling pattern). In it, "Hand Tools" shows when the menu opens and
    // "Archived" never does. menus-toggle-broken: the dropdown never opens.
    "menus": "the home page has a collapsing site nav and a closed Categories dropdown",
    "menus-toggle-broken": "as menus, but the Categories dropdown's button does nothing",
    // TFP-160: /forms loses a field its form check recorded.
    "forms-missing-field": "the /forms search form has no Tag field",
    // TFP-161: the home page drops the connection (/unreachable always does).
    "hub-down": "the home page cannot be loaded: the connection is dropped",
    // Phase 38 (TFP-149): Core Web Vitals bands. The slow-LCP defects hold
    // the home page's hero image back, so the load event and the largest
    // contentful paint land about 3 s or 5 s in; the layout-shift defects
    // push the home page's content down by a banner inserted just after it
    // first renders, sized so CLS comes to about 0.15 or 0.3 (the banner's
    // height over the viewport's longest side, with the shifted content
    // covering the viewport). The clean site's responses are unchanged.
    "performance-lcp-3s": "the home page's hero image arrives 3 s late: LCP about 3 s (needs improvement)",
    "performance-lcp-5s": "the home page's hero image arrives 5 s late: LCP about 5 s (poor)",
    "performance-shift-0.15": "the home page's content is pushed down after it renders: CLS about 0.15 (needs improvement)",
    "performance-shift-0.3": "the home page's content is pushed down after it renders: CLS about 0.3 (poor)",
};

const LCP_DELAYS = { "performance-lcp-3s": 3000, "performance-lcp-5s": 5000 };
const SHIFT_SCORES = { "performance-shift-0.15": 0.15, "performance-shift-0.3": 0.3 };

// The hero image. Chrome leaves low-entropy images (under about 0.05 bits per
// displayed pixel) out of LCP, so a plain rectangle would never be the
// largest contentful paint: this one draws 400 circles (fixed, not random,
// so every run serves the same bytes), about 25 KB for 960x480.
const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480"><rect width="960" height="480" fill="#334"/>${Array.from({ length: 400 }, (_, i) => `<circle cx="${(i * 97) % 960}" cy="${(i * 53) % 480}" r="${4 + (i % 23)}" fill="#${(((i * 2654435761) >>> 0) % 0xffffff).toString(16).padStart(6, "0")}" opacity="0.8"/>`).join("")}<text x="40" y="260" font-size="64" fill="#fff">Acme Notes</text></svg>`;

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
    const shift = SHIFT_SCORES[defect];
    const shiftScript = shift
        ? `\nsetTimeout(() => { const banner = document.createElement('div'); banner.style.height = Math.round(${shift} * Math.max(innerWidth, innerHeight)) + 'px'; banner.style.background = '#fde68a'; banner.textContent = 'Notice'; document.body.prepend(banner); }, 200);`
        : "";
    const lcpDelay = LCP_DELAYS[defect];
    const menus = defect === "menus" || defect === "menus-toggle-broken";
    const menusScript = menus
        ? `
document.querySelector('.nav-toggle').addEventListener('click', (e) => { const open = document.getElementById('site-nav').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); });${defect === "menus" ? `
document.querySelector('.dropdown-toggle').addEventListener('click', (e) => { const open = e.currentTarget.nextElementSibling.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); });` : ""}`
        : "";
    return page(
        "Home",
        `${menus ? `<style>.nav-toggle{display:none}.dropdown-list{display:none;margin:0;padding:0;list-style:none}.dropdown-list.open{display:block}@media (max-width:600px){.nav-toggle{display:inline-block}#site-nav{display:none}#site-nav.open{display:block}}</style>
<button type="button" class="nav-toggle" aria-controls="site-nav" aria-expanded="false" aria-label="Open site menu">Menu</button>
<div id="site-nav"><a href="/notes?view=shop">Shop</a>
<div class="dropdown"><button type="button" class="dropdown-toggle" aria-expanded="false">Categories</button><ul class="dropdown-list"><li><a href="/notes?category=hand-tools">Hand Tools</a></li><li style="display:none"><a href="/notes?category=archived">Archived</a></li></ul></div>
</div>
` : ""}<h1>Acme Notes</h1>
<p${defect === "a11y-low-contrast" ? ' style="color:#c8c8c8"' : defect === "a11y-text-over-image" ? ' style="color:#fff;background-image:url(/hero.svg);padding:1em"' : ""}>Write short notes and find them again later.</p>${defect === "a11y-missing-alt" ? `
<p><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23336'/%3E%3C/svg%3E" width="40" height="40"></p>` : ""}
<p id="status">Checking status...</p>
<p><a href="${defect === "security-token-in-url" ? "/notes?sessionid=4f9c2a1e7b" : "/notes"}">Go to your notes</a></p>${lcpDelay ? `
<p><img src="/hero.svg?delay=${lcpDelay}" width="960" height="480" alt="Acme Notes on a laptop"></p>` : ""}${shift ? `
<div style="height:200vh;background:#f4f4f5">Notes you wrote recently</div>` : ""}`,
        { meta: defect !== "seo-missing-meta", script: crashScript + shiftScript + menusScript }
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

    if (url.pathname === "/hero.svg") {
        // TFP-149: the slow-LCP defects' hero image, held back by ?delay= ms.
        // TFP-148: a11y-text-over-image's background, not held back.
        await new Promise((r) => setTimeout(r, Math.min(Number(url.searchParams.get("delay")) || 0, 10000)));
        return send(200, HERO_SVG, "image/svg+xml");
    }
    if (url.pathname === "/api/status") return send(200, JSON.stringify({ message: "All systems normal" }), "application/json");
    // TFP-161: a page inspection can't load - the connection is dropped, as
    // the-internet's host did. hub-down does the same to the home page,
    // which links to every other page.
    if (url.pathname === "/unreachable" || (url.pathname === "/" && defect === "hub-down")) {
        req.socket.destroy();
        return;
    }
    if (url.pathname === "/" && req.method === "GET") {
        const cookie =
            defect === "security-weak-session-cookie" ? { "set-cookie": "sid=acme-4f9c2a1e7b; Path=/; Max-Age=34560000" }
            : defect === "security-mixed-cookies" ? { "set-cookie": ["sid=acme-4f9c2a1e7b; Path=/", "_ga=GA1.1.1234567890; Path=/", "theme=dark; Path=/"] }
            : {};
        return send(200, home(), undefined, cookie);
    }
    if (url.pathname === "/login" && req.method === "GET") return send(200, login());
    if (url.pathname === "/login" && req.method === "POST") {
        const form = await readForm(req);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email ?? "")) return send(200, login("Enter a valid email address."));
        return send(303, "", "text/plain", { location: "/notes" });
    }
    if (url.pathname === "/notes" && req.method === "GET") return send(200, notesPage());
    // TFP-141: the in-page links the anchor-target check met on a real site -
    // a placeholder href="#" (which crashed it), a real target and #top. The
    // check passes here, with a finding for the placeholder. Not linked from
    // the nav, so introspection finds it only when asked for /anchors.
    if (url.pathname === "/anchors" && req.method === "GET") {
        return send(200, page("Anchors", `<h1>Anchors</h1>
<p><a href="#">Menu</a> <a href="#details">Details</a> <a href="#top">Back to top</a></p>
<h2 id="details">Details</h2>`));
    }
    // TFP-145: the links the Standard accessible-name check misjudged on a
    // real site - a menu link whose text sits in a <span> (named; it failed
    // as unnamed), two "Open" links to different places, one of them
    // genuinely unnamed (its text is aria-hidden), and an image link with no
    // alt (unnamed). Not linked from the nav, like /anchors.
    if (url.pathname === "/names" && req.method === "GET") {
        return send(200, page("Link names", `<h1>Link names</h1>
<ul class="menu"><li><a href="/"><span>Home</span></a></li><li><a href="/notes"><span>Notes</span></a></li></ul>
<p><a href="/notes">Open</a> <a href="/login"><span aria-hidden="true">Open</span></a></p>
<p><a href="/login?from=icon"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='%23336'/%3E%3C/svg%3E" width="20" height="20"></a></p>`));
    }
    // TFP-160: the forms the Standard form check misjudged on a real site -
    // one with several labelled fields (looked up by all its labels joined,
    // which no element holds) and one holding a lone <select> (matched by
    // its options' joined text, so the check counted fields inside the
    // <select>). As on the site, the fields sit in their own <div>s with no
    // text between them, the submit is an <input> (Playwright counts its value
    // as the form's text; introspection's textContent doesn't), and the forms
    // have no id. forms-missing-field drops the first
    // form's "tag" field. Not linked from the nav, like /anchors.
    if (url.pathname === "/forms" && req.method === "GET") {
        return send(200, page("Forms", `<h1>Forms</h1>
<form action="/notes" method="get"><div><label for="f-title">Title *</label><input id="f-title" name="title"></div>${defect === "forms-missing-field" ? "" : `<div><label for="f-tag">Tag *</label><input id="f-tag" name="tag"></div>`}<div><label for="f-body">Body</label><textarea id="f-body" name="body"></textarea></div><div><input type="submit" value="Search"></div></form>
<form><select aria-label="Sort"><option>Name (A - Z)</option><option>Name (Z - A)</option></select></form>`));
    }
    // TFP-165: a hash-routed single-page app, as Angular's and Vue's hash modes
    // and React Router's HashRouter build them. Every route is the same
    // document; the app draws the route after a request to /api/status (so a
    // check that doesn't wait sees "Loading..."). #/chainsaws is linked but
    // missing: the app draws its "not found" view, as for any unknown route.
    // #!/legacy is the older hashbang form. #top and #details are real in-page
    // anchors. Not linked from the nav, like /anchors.
    if (url.pathname === "/spa" && req.method === "GET") {
        return send(200, `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Acme Shop</title></head>
<body>
<nav><a href="#/">Home</a> <a href="#/contact">Contact</a> <a href="#/products">Products</a> <a href="#!/legacy">Legacy</a> <a href="#/chainsaws">Chainsaws</a></nav>
<main id="view">Loading...</main>
<script>
const views = {
  "/": '<h1 id="top">Acme Shop</h1><p><a href="#details">Details</a> <a href="#/products/1">First product</a></p><h2 id="details">Details</h2><p><a href="#top">Back to top</a></p>',
  "/contact": "<h1>Contact</h1><p>Write to us.</p>",
  "/products": '<h1>Products</h1><p><a href="#/products/1">First product</a></p>',
  "/products/1": "<h1>First product</h1><p>A hammer.</p>",
  "/legacy": "<h1>Legacy</h1><p>An old hashbang route.</p>",
  "/offer": "<h1>Offer</h1><p>No other route links here (TFP-166: an orphan route).</p>",
};
if (!location.hash) location.replace("#/");
async function draw() {
  const route = location.hash.replace(/^#!?/, "") || "/";
  await fetch("/api/status");
  document.getElementById("view").innerHTML = views[route] ?? "<h1>Page not found</h1><p>Nothing lives here.</p>";
}
addEventListener("hashchange", draw);
draw();
</script>
</body>
</html>`);
    }
    // TFP-167: a page that draws its content late, as a single-page app does.
    // The HTML is a shell; the form and the button appear only after
    // /api/slow answers, 1.5 s later. A check that runs at domcontentloaded
    // or load sees "Loading...". Path-routed: the gap isn't only hash routes'.
    // Not linked from the nav, like /anchors.
    if (url.pathname === "/api/slow") {
        await new Promise((r) => setTimeout(r, 1500));
        return send(200, JSON.stringify({ ready: true }), "application/json");
    }
    if (url.pathname === "/late-form" && req.method === "GET") {
        const late = `<h1>Late form</h1><form aria-label="Search notes" action="/notes" method="get"><div><label for="lf-title">Title</label><input id="lf-title" name="title"></div><div><label for="lf-tag">Tag</label><input id="lf-tag" name="tag"></div><div><input type="submit" value="Search" style="padding:6px 12px"></div></form><p><button type="button" style="padding:6px 12px"><span>Save draft</span></button></p>`;
        return send(200, page("Late form", `<div id="app">Loading...</div>`, { script: `fetch("/api/slow").then(() => { document.getElementById("app").innerHTML = ${JSON.stringify(late)}; });` }));
    }
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
