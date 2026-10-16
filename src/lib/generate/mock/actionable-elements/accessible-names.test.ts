/**
 * TFP-145: the Standard accessible-name check must test the link it was
 * generated for. It located most links with getByText(text).first(), which
 * resolves to the element holding the text - the <span> inside a menu link,
 * which has no accessible name - and makes every same-text link test the
 * first one. On rizonetech.com that failed named links (TFAC-008 "Home",
 * 009 "Services", 018 and 038 "AI").
 *
 * The page here is introspected for real (inspectPages), so the checks are
 * generated from exactly what introspection records.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/actionable-elements/accessible-names.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { ContentProfile } from "../types.ts";

const { buildAccessibilityElementTests } = await import("./index.ts");
const { inspectPages } = await import("../../../introspect/inspector.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

// A menu link whose text is in a <span>, the same link again in the footer
// with plain text, two "Open" links to different places (the second one's
// text is aria-hidden, so it has no name), and an image link with no alt.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Names</title></head><body>
<nav><ul class="menu"><li><a href="/"><span>Home</span></a></li><li><a href="/services/"><span>Services</span></a></li></ul></nav>
<main><h1>Names</h1>
<p><a href="/notes">Open</a> <a href="/login"><span aria-hidden="true">Open</span></a></p>
<p><a href="/login?from=icon"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="20" height="20"></a></p>
</main>
<footer><p>Footer</p><a href="/">Home</a></footer>
</body></html>`;

// TFP-145 follow-up: a visible menu link, a hidden (mobile) copy in the same
// container, and a visible footer copy. Introspection drops the hidden copy as
// a duplicate of the menu link, so it records two visible "Home" links - but
// the page has three. ISTQB technique: error guessing - the fault was found by
// reading introspection's dedupe, and this page is built to trigger it.
const HIDDEN_COPY_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hidden copy</title></head><body>
<nav><ul class="menu"><li><a href="/">Home</a></li><li style="display: none"><a href="/">Home</a></li><li><a href="/about/">About</a></li></ul></nav>
<main><h1>Hidden copy</h1></main>
<footer><p>Footer</p><a href="/">Home</a></footer>
</body></html>`;

test("the generated checks type-check, no link check uses getByText or .first(), and positions count only links of the same visibility", () => {
    const profile = {
        pages: [{
            path: "/", url: "http://x.test/", title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [],
            actionableElements: [
                { text: "Home", url: "http://x.test/", category: "navigation", elementType: "link", containerLabel: "", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role: "link", name: "", label: "", placeholder: "", id: "", inputType: "" } },
                { text: "Home", url: "http://x.test/", category: "navigation", elementType: "link", containerLabel: "Footer", expectedStatus: null, isVisible: false, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role: "link", name: "", label: "", placeholder: "", id: "", inputType: "" } },
                { text: "Home", url: "http://x.test/", category: "navigation", elementType: "link", containerLabel: "Legal", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role: "link", name: "", label: "", placeholder: "", id: "", inputType: "" } },
            ],
        }],
    } as unknown as ContentProfile;
    const tests = buildAccessibilityElementTests(profile, "/");
    assert.equal(tests.length, 3);
    assert.deepEqual(findTypeErrors(`import { test, expect } from '@playwright/test';\n${tests.join("\n")}\n`), []);
    for (const code of tests) assert.doesNotMatch(code, /getByText|\.first\(\)/);
    // Visible, hidden, visible: the hidden link is the first hidden one; the third is the second visible one.
    assert.match(tests[0], /visible: true, occurrence: 0 /);
    assert.match(tests[1], /visible: false, occurrence: 0 /);
    assert.match(tests[2], /visible: true, occurrence: 1 /);
});

/** Serves the given pages by path (404 otherwise) on a free local port. */
async function serve(pages: Record<string, string>) {
    const server = createServer((req, res) => {
        const page = pages[new URL(req.url ?? "/", "http://x").pathname];
        res.writeHead(page ? 200 : 404, { "content-type": "text/html; charset=utf-8" }).end(page ?? "");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return {
        origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: async () => {
            server.closeAllConnections();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}

/** Runs generated tests through the Playwright CLI, returning each one's outcome and message by title. */
async function runGenerated(tests: string[], baseURL: string) {
    // Real suites number their tests (TFAC-NNN); same-text links share a title, so number them here too.
    const numbered = tests.map((code, index) => code.replace("test('", `test('${index + 1}: `));
    const { report } = await runPlaywrightSpec(`import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\n${numbered.join("\n")}\n`, `accessible-names-unit`, ["--workers=1"]);
    return flattenSuites(report.suites)
        .map((record) => ({ title: record.title.replace(/^\d+: accessible name and role: /, ""), status: record.status, message: record.status === "Passed" ? "" : record.rawMessage }));
}

test("in a real browser: a span-wrapped menu link passes; same-text links each test their own link; unnamed links fail by name", { skip: needsChromium }, async () => {
    const { origin, close } = await serve({ "/names": PAGE });
    try {
        const { pages } = await inspectPages(origin, ["/names"]);
        const tests = buildAccessibilityElementTests({ pages } as unknown as ContentProfile, "/names");
        const results = await runGenerated(tests, origin);
        const by = (title: string) => results.filter((result) => result.title === title);

        // The menu link with its text in a <span>, and the footer copy: both named.
        assert.ok(by("Home [link]").length >= 1, JSON.stringify(results));
        for (const result of [...by("Home [link]"), ...by("Services [link]")]) assert.equal(result.status, "Passed", result.message);

        // Two "Open" links: the one to /notes is named, the one to /login is not.
        const open = by("Open [link]");
        assert.deepEqual(open.map((result) => result.status), ["Passed", "Failed"], JSON.stringify(open));
        assert.match(open[1].message, /Open has no accessible name/);

        // The image link with no alt fails, naming its target.
        const icon = by(`Untitled link to ${origin}/login?from=icon [link]`);
        assert.equal(icon.length, 1, JSON.stringify(results));
        assert.equal(icon[0].status, "Failed");
        assert.match(icon[0].message, /Untitled link to .*\/login\?from=icon has no accessible name/);
    } finally {
        await close();
    }
});

test("in a real browser: a hidden copy in the menu does not shift the footer link's check onto it", { skip: needsChromium }, async () => {
    const { origin, close } = await serve({ "/hidden-copy": HIDDEN_COPY_PAGE });
    try {
        const { pages } = await inspectPages(origin, ["/hidden-copy"]);
        const recorded = pages[0].actionableElements.filter((element) => element.text === "Home");
        // The scenario needs introspection to have dropped the hidden copy.
        assert.deepEqual(recorded.map((element) => element.isVisible), [true, true], JSON.stringify(recorded));

        const tests = buildAccessibilityElementTests({ pages } as unknown as ContentProfile, "/hidden-copy");
        const home = (await runGenerated(tests, origin)).filter((result) => result.title === "Home [link]");
        assert.deepEqual(home.map((result) => result.status), ["Passed", "Passed"], JSON.stringify(home));
    } finally {
        await close();
    }
});

// TFP-152: HTML-AAM 4.1.10 - an <img alt=""> is presentational and has no
// name; its title is used only when there is no alt attribute. Playwright
// 1.59.1 falls back to the title, so a logo link like rizonetech.com's
// (TFAC-007) passed though it has no name. A title on the link itself is a
// valid name (accname step 2I), and so is a non-empty alt.
// ISTQB technique: equivalence partitioning - where the only text sits: the
// image's title, the link's title, the image's alt. Boundary value analysis
// on the alt: empty, and blank (" "), which HTML-AAM treats as empty once
// trimmed while Playwright treats it as a real image (TFP-152 follow-up).
const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const IMAGE_LINKS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Image links</title></head><body><main><h1>Image links</h1>
<p><a href="/logo"><img src="${GIF}" width="20" height="20" alt="" title="Home"></a></p>
<p><a href="/blank"><img src="${GIF}" width="20" height="20" alt=" " title="Home"></a></p>
<p><a href="/titled" title="Home"><img src="${GIF}" width="20" height="20" alt=""></a></p>
<p><a href="/alt"><img src="${GIF}" width="20" height="20" alt="Home"></a></p>
</main></body></html>`;

test("in a real browser: an image link named only by an alt=\"\" or alt=\" \" image's title fails, citing HTML-AAM 4.1.10; a titled link and an alt-named image pass", { skip: needsChromium }, async () => {
    const { origin, close } = await serve({ "/image-links": IMAGE_LINKS_PAGE });
    try {
        const { pages } = await inspectPages(origin, ["/image-links"]);
        const tests = buildAccessibilityElementTests({ pages } as unknown as ContentProfile, "/image-links");
        const results = await runGenerated(tests, origin);
        // Introspection records no text for an image link, so each is titled by its target.
        const byTarget = Object.fromEntries(["/logo", "/blank", "/titled", "/alt"].map((path) => [path, results.filter((result) => result.title === `Untitled link to ${origin}${path} [link]`)]));
        assert.equal(results.length, 4, JSON.stringify(results));
        assert.deepEqual(Object.fromEntries(Object.entries(byTarget).map(([path, list]) => [path, list.map((result) => result.status)])), { "/logo": ["Failed"], "/blank": ["Failed"], "/titled": ["Passed"], "/alt": ["Passed"] }, JSON.stringify(results));
        assert.match(byTarget["/logo"][0].message, /has no accessible name: HTML-AAM 4\.1\.10/);
        assert.match(byTarget["/logo"][0].message, /\/logo/, "names the link");
        assert.match(byTarget["/blank"][0].message, /\/blank has no accessible name: HTML-AAM 4\.1\.10/);
    } finally {
        await close();
    }
});
