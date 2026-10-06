/**
 * TFP-165: `#/` links are pages on sites that route by hash (decisions
 * approved by Emil, 2026-10-06).
 *
 * ISTQB technique: equivalence partitioning over the fragment - a route
 * (`#/contact`, `#!/legacy`), an in-page anchor (`#top`, `#details`), a
 * bare `#`, and no fragment - then, on the fixture's hash-routed app
 * (`/spa`), the crawl, introspection's link types and the generated link
 * checks for each partition, including a linked route that is missing.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/introspect/routes.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../report/types.ts";
import type { LinkDetail } from "../generate/mock/types.ts";

const { isRouteFragment, pagePathOf, crawlKeyOf } = await import("./routes.ts");
const { inspectPages } = await import("./inspector.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { findTypeErrors } = await import("../generate/validate.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

test("Decision 1 and 2: a fragment starting with / or !/ is a route, named as the address bar shows it; anything else is an in-page anchor", () => {
    for (const route of ["#/", "#/contact", "#/product/1", "#!/legacy"]) assert.equal(isRouteFragment(route), true, route);
    for (const anchor of ["#", "#top", "#details", "#filters", "", "#contact/"]) assert.equal(isRouteFragment(anchor), false, anchor);

    assert.equal(pagePathOf(new URL("https://shop.test/#/contact")), "/#/contact");
    assert.equal(pagePathOf(new URL("https://shop.test/#/contact/")), "/#/contact");
    assert.equal(pagePathOf(new URL("https://shop.test/#/")), "/#/");
    assert.equal(pagePathOf(new URL("https://shop.test/app/#!/legacy")), "/app#!/legacy");
    // Path-routed pages are named as before.
    assert.equal(pagePathOf(new URL("https://shop.test/contact/#top")), "/contact");
    assert.equal(pagePathOf(new URL("https://shop.test/")), "/");

    // The crawl's key keeps a route, drops an anchor and the query, as before for paths.
    assert.equal(crawlKeyOf(new URL("https://shop.test/?x=1#/contact")).toString(), "https://shop.test/#/contact");
    assert.equal(crawlKeyOf(new URL("https://shop.test/contact/?x=1#top")).toString(), "https://shop.test/contact");
});

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `hash-routes-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

test("in a real browser: the crawl finds every linked route of the fixture's hash-routed app as its own page", { skip: needsChromium }, async () => {
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
        // Each route once, named as the address bar shows it; the missing one is a page too (the crawl doesn't judge it).
        assert.deepEqual(crawl.result.pages.map((page: { path: string }) => page.path), ["/spa#!/legacy", "/spa#/", "/spa#/chainsaws", "/spa#/contact", "/spa#/products", "/spa#/products/1"]);
        // Each was drawn before it was read (the app draws after a request): no page is still "Loading...".
        assert.ok(crawl.result.pages.every((page: { title: string }) => page.title === "Acme Shop"), JSON.stringify(crawl.result.pages));
    } finally {
        await fixture.close();
    }
});

test("in a real browser: routes are internal links, anchors stay anchors; a linked missing route fails link health, naming it; #top and #details pass the anchor check", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/spa#/"]);
        assert.deepEqual(inspection.failedPages, []);
        const links: LinkDetail[] = inspection.pages[0].linkDetails ?? [];
        assert.deepEqual(links.map((link) => [link.rawHref, link.linkType]), [
            ["#/", "internal"], ["#/contact", "internal"], ["#/products", "internal"], ["#!/legacy", "internal"], ["#/chainsaws", "internal"],
            ["#details", "anchor"], ["#/products/1", "internal"], ["#top", "anchor"],
        ], "introspection read the drawn route, not 'Loading...'");

        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        // Deep mode: every link gets its own health check.
        const code = mockGenerate(fixture.origin, "Check the site.", ["functional"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("deep"));
        assert.deepEqual(findTypeErrors(code), []);
        const records = await runSuite(code, "spa");
        const one = (title: RegExp) => {
            const found = records.filter((record) => title.test(record.title));
            assert.equal(found.length, 1, `${title}: ${records.map((record) => record.title).join(" | ")}`);
            return found[0];
        };

        const bulk = one(/link health: linked routes draw a page, not the app's "not found" view/);
        assert.equal(bulk.status, "Failed", JSON.stringify(bulk));
        assert.match(bulk.rawMessage, /linked routes that show the app's "not found" view: \/spa#\/chainsaws \(draws the same as \/spa#\/testforge-missing-[a-z0-9]+, a route that cannot exist\)/);
        assert.doesNotMatch(bulk.rawMessage.split("\n")[0], /contact|products|legacy/, "only the missing route");

        const chainsaws = one(/navigation link health: Chainsaws/);
        assert.equal(chainsaws.status, "Failed");
        assert.match(chainsaws.rawMessage, /\/spa#\/chainsaws draws the same as \/spa#\/testforge-missing-[a-z0-9]+, a route that cannot exist: the app shows its "not found" view/);
        for (const name of ["Contact", "Products", "Legacy", "First product"]) {
            assert.equal(one(new RegExp(`navigation link health: ${name}`)).status, "Passed", name);
        }

        const anchors = one(/anchor links point to existing in-page targets/);
        assert.equal(anchors.status, "Passed", JSON.stringify(anchors));
        assert.equal(one(/link types: internal, external/).status, "Passed");
        assert.equal(one(/link health: internal, external, and download links do not return broken responses/).status, "Passed");
    } finally {
        await fixture.close();
    }
});
