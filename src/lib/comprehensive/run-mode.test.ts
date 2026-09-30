/**
 * Phase 35 (TFP-132, Decisions 1 and 2): run modes, the page scope and cap,
 * and the one-worker rule.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/comprehensive/run-mode.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { normalizeRunMode, RunModeError, isLocalDevelopmentHost, workerCountFor, DEFAULT_PAGE_CAP, STANDARD_RUN } = await import("./run-mode.ts");
const { selectComprehensivePages } = await import("./pages.ts");

test("normalizeRunMode: absent or standard is a Standard run", () => {
    assert.deepEqual(normalizeRunMode(undefined), STANDARD_RUN);
    assert.deepEqual(normalizeRunMode(null), STANDARD_RUN);
    assert.deepEqual(normalizeRunMode({ kind: "standard" }), STANDARD_RUN);
});

test("normalizeRunMode: a Comprehensive run for security is passive, with the default cap unless one is given", () => {
    assert.deepEqual(normalizeRunMode({ kind: "comprehensive", area: "security" }), { kind: "comprehensive", area: "security", level: "passive", pageCap: DEFAULT_PAGE_CAP });
    assert.equal(DEFAULT_PAGE_CAP, 20);
    assert.deepEqual(normalizeRunMode({ kind: "comprehensive", area: "accessibility", pageCap: 5 }), { kind: "comprehensive", area: "accessibility", level: null, pageCap: 5 });
});

test("normalizeRunMode: anything else is refused, never run as a different run", () => {
    for (const input of [
        "comprehensive",
        { kind: "deep" },
        { kind: "comprehensive" },
        { kind: "comprehensive", area: "seo/content" },
        { kind: "comprehensive", area: "security", level: "active" },
        { kind: "comprehensive", area: "accessibility", level: "passive" },
        { kind: "comprehensive", area: "security", pageCap: 0 },
        { kind: "comprehensive", area: "security", pageCap: 101 },
        { kind: "comprehensive", area: "security", pageCap: 2.5 },
        { kind: "comprehensive", area: "security", pageCap: "20" },
    ]) {
        assert.throws(() => normalizeRunMode(input), RunModeError, JSON.stringify(input));
    }
});

test("isLocalDevelopmentHost: localhost, .localhost and loopback only", () => {
    for (const url of ["http://localhost:3000", "http://127.0.0.1:4410", "http://127.8.9.10", "http://app.localhost", "http://[::1]:8080", "http://0.0.0.0:3000"]) {
        assert.equal(isLocalDevelopmentHost(url), true, url);
    }
    for (const url of ["https://the-internet.herokuapp.com", "http://192.168.1.10", "http://localhost.example.com", "http://10.0.0.1", "not a url", undefined]) {
        assert.equal(isLocalDevelopmentHost(url), false, String(url));
    }
});

test("workerCountFor: one worker for a Comprehensive run on anyone else's host; Standard runs keep theirs", () => {
    const comprehensive = normalizeRunMode({ kind: "comprehensive", area: "security" });
    assert.equal(workerCountFor(comprehensive, "https://the-internet.herokuapp.com", 4), 1);
    assert.equal(workerCountFor(comprehensive, "http://127.0.0.1:4410", 4), 4);
    assert.equal(workerCountFor(STANDARD_RUN, "https://the-internet.herokuapp.com", 4), 4);
    assert.equal(workerCountFor(STANDARD_RUN, "https://the-internet.herokuapp.com", 2), 2);
});

const page = (path: string) => ({ path, url: `https://site.test${path}`, title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [] });

test("selectComprehensivePages: inspected pages first, then crawled ones, same origin, no repeats, up to the cap", () => {
    const profile = {
        scannedAt: "",
        baseUrl: "https://site.test",
        pages: [page("/"), page("/login")],
        siteGraph: {
            nodes: [
                { path: "/login", url: "https://site.test/login", title: "", inspected: true },
                { path: "/about", url: "https://site.test/about", title: "", inspected: false },
                { path: "/x", url: "https://elsewhere.test/x", title: "", inspected: false },
                { path: "/help?q=1", url: "https://site.test/help?q=1", title: "", inspected: false },
            ],
            edges: [],
        },
    };
    assert.deepEqual(selectComprehensivePages(profile as never, "https://site.test", 20), { covered: ["/", "/login", "/about", "/help?q=1"], notCovered: [], pageCap: 20 });
    assert.deepEqual(selectComprehensivePages(profile as never, "https://site.test", 2), { covered: ["/", "/login"], notCovered: ["/about", "/help?q=1"], pageCap: 2 });
});

test("selectComprehensivePages: with no page data the run covers the landing page", () => {
    assert.deepEqual(selectComprehensivePages(null, "https://site.test/", 20), { covered: ["/"], notCovered: [], pageCap: 20 });
});
