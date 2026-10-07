/**
 * Phase 40 Decision 1 (TFP-170): crawled pages grouped into types by address
 * pattern.
 *
 * ISTQB technique: equivalence partitioning over address segments - an
 * identifier (digits, ULID, UUID, hex), a slug among siblings under a shared
 * parent, a top-level page, a hash route, and a query string - then the two
 * committed Toolshop crawls (path-routed and hash-routed) and a real crawl of
 * the fixture's hash-routed app.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/selection/page-types.test.ts
 */
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const { groupPagesByAddress, isIdSegment } = await import("./page-types.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const patterns = (names: string[]) => groupPagesByAddress(names).map((type: { pattern: string; pages: string[] }) => `${type.pattern} ${type.pages.length}`);

test("identifiers become :id - digits, ULIDs, UUIDs, long hex - and words don't", () => {
    for (const id of ["1", "42", "01M48AGCWN26TFYQ1FQ6S7FNJF", "3f2b8c1e-9a4d-4b7e-8f21-0c5d6e7a8b9c", "a3f9c2e17b"]) assert.equal(isIdSegment(id), true, id);
    for (const word of ["hand-tools", "contact", "login", "forgot-password", "v2", "abc", "deadbeef"]) assert.equal(isIdSegment(word), false, word);
    assert.deepEqual(patterns(["/product/01M48AGCWN26TFYQ1FQ6S7FNJF", "/product/01M48AGCWS8B3WGHXSPQHN6PDH"]), ["/product/:id 2"]);
    // An id with no sibling is still an id: it names one of many.
    assert.deepEqual(patterns(["/product/7"]), ["/product/:id 1"]);
});

test("siblings under a shared parent become :slug; top-level pages and a lone child stay literal", () => {
    assert.deepEqual(patterns(["/category/hand-tools", "/category/power-tools", "/category/other"]), ["/category/:slug 3"]);
    assert.deepEqual(patterns(["/contact", "/privacy", "/rentals"]), ["/contact 1", "/privacy 1", "/rentals 1"], "no shared parent at the top level");
    assert.deepEqual(patterns(["/blog/2026/first-post", "/blog/2026/second-post"]), ["/blog/:id/:slug 2"]);
    assert.deepEqual(patterns(["/category/hand-tools"]), ["/category/hand-tools 1"], "a lone child doesn't vary");
    assert.deepEqual(patterns(["/", "/contact"]), ["/ 1", "/contact 1"]);
});

test("hash routes group by their route, as TFP-165 names them; the start route is its own type", () => {
    assert.deepEqual(patterns(["/#/", "/#/product/1", "/#/product/2", "/#/category/hand-tools", "/#/category/power-tools", "/#/contact"]), ["/#/ 1", "/#/product/:id 2", "/#/category/:slug 2", "/#/contact 1"]);
    assert.deepEqual(patterns(["/app#!/legacy", "/app#!/item/9"]), ["/app#!/legacy 1", "/app#!/item/:id 1"]);
});

test("addresses differing only by query string are one type", () => {
    assert.deepEqual(groupPagesByAddress(["/search?q=hammer", "/search?q=saw", "/search"]), [{ pattern: "/search", pages: ["/search?q=hammer", "/search?q=saw", "/search"] }]);
    assert.deepEqual(patterns(["/#/search?q=a", "/#/search?q=b"]), ["/#/search 2"]);
});

test("the committed Toolshop crawls: path-routed and hash-routed give the same patterns, apart from the sites' own pages", async () => {
    const crawl = async (file: string) => {
        const json = JSON.parse(await readFile(join(process.cwd(), "benchmarks", "2026-10-06-toolshop-known-bugs", file), "utf8"));
        return groupPagesByAddress(json.result.pages.map((page: { path: string }) => page.path)) as Array<{ pattern: string; pages: string[] }>;
    };
    const clean = await crawl("clean-tfp165-crawl.json");
    const withBugs = await crawl("with-bugs-tfp165-crawl.json");
    const byPattern = (types: Array<{ pattern: string; pages: string[] }>) => Object.fromEntries(types.map((type) => [type.pattern.replace(/^\/#/, "") || "/", type.pages.length]));
    assert.deepEqual(byPattern(clean), { "/": 1, "/auth/:slug": 3, "/category/:slug": 4, "/contact": 1, "/privacy": 1, "/product/:id": 35, "/rentals": 1 });
    assert.deepEqual(byPattern(withBugs), { "/": 1, "/auth/:slug": 3, "/category/:slug": 3, "/chainsaws": 1, "/contact": 1, "/product/:id": 24, "/rentals": 1 });
    // The same patterns, but /privacy (clean only) and /chainsaws (with-bugs only), the sites' own pages.
    const shared = Object.keys(byPattern(clean)).filter((pattern) => pattern in byPattern(withBugs));
    assert.deepEqual(shared, ["/", "/auth/:slug", "/category/:slug", "/contact", "/product/:id", "/rentals"]);
    assert.ok(withBugs.every((type) => type.pattern.startsWith("/#/")), "hash-routed types keep TFP-165's names");
});

test("in a real browser: the crawl records its page types (the fixture's hash-routed app)", { skip: needsChromium }, async () => {
    const { POST, GET } = await import("../../app/api/crawl/route.ts");
    const { NextRequest } = await import("next/server");
    const fixture = await startRecordedFixture();
    try {
        const started = await (await POST(new NextRequest(new URL("http://localhost/api/crawl"), { method: "POST", body: JSON.stringify({ baseUrl: `${fixture.origin}/spa` }) }))).json();
        let crawl = started;
        while (crawl.crawlStatus === "running") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            crawl = await (await GET(new NextRequest(new URL(`http://localhost/api/crawl?crawlId=${started.crawlId}`)))).json();
        }
        assert.equal(crawl.crawlStatus, "completed", JSON.stringify(crawl));
        const types = crawl.result.pageTypes.map((type: { pattern: string; pages: string[] }) => `${type.pattern} ${type.pages.join(",")}`).sort();
        assert.deepEqual(types, [
            "/spa#!/legacy /spa#!/legacy",
            "/spa#/ /spa#/",
            "/spa#/chainsaws /spa#/chainsaws",
            "/spa#/contact /spa#/contact",
            "/spa#/products /spa#/products",
            "/spa#/products/:id /spa#/products/1",
        ]);
    } finally {
        await fixture.close();
    }
});
