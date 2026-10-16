/**
 * Phase 42 (TFP-205; Gate B ruling, Emil 2026-10-15): the template checks every link on the pages it selects.
 * No live Toolshop run and no model call (Emil): fixtures in a real browser, and the committed Toolshop data
 * offline.
 *
 * ISTQB technique: decision table. Conditions: where the link leads (same origin and working; same origin and
 * broken; another origin) and how often it appears (once; on two pages), against who loads its target (the
 * link-health check already; no check, so this test, under a cap). Columns:
 *   working, same origin            -> its test passes; the target is link health's to load, not loaded again
 *   broken, same origin             -> link health fails naming it; with no other check loading it, its own test
 *                                      loads it and fails with the status
 *   another origin                  -> the href is checked, and this test sends it no request
 *   on two pages                    -> one test, on the first page
 *   over the cap                    -> not loaded, and named as not loaded
 * Offline, on TFP-197's crawls: the pages each copy's crawl selected for Standard, with the links inspection
 * recorded on those pages (Gate B's committed inspection, TFP-188: TFP-197 kept no inspection of its own),
 * leave no link on the coverage map's in-context gap list.
 * Gate: Phase 42 (TFP-205; Phase 42 closes when it is verified).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/inventory-tests.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { ExecutionRecord } from "../../../report/types.ts";
import type { BestPracticeArea, ContentProfile } from "../types.ts";

const { mockGenerate } = await import("../index.ts");
const { normalizeContentProfile, normalizeContentRules, normalizeTestAuditMode } = await import("../../normalize.ts");
const { inspectPages } = await import("../../../introspect/inspector.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { buildCoverageMap, untouched } = await import("../../../report/coverage-map.ts");
const { parseTestUnits } = await import("../../../site-suites/units.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { READ_ONLY_GUARD_HELPER } = await import("../../read-only-guard.ts");
const { buildLinkInventoryTests } = await import("./inventory-tests.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

const AREAS: BestPracticeArea[] = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
const isInventory = (title: string) => /^(TF[A-Z]+-\d+: )?link "/.test(title);

// The fixture: a site, and another origin it links to, which records every request it gets.
let site: Server;
let other: Server;
let origin = "";
let otherOrigin = "";
const otherRequests: string[] = [];
const listen = (server: Server) => new Promise<string>((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)));
const html = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Links</title></head><body><main>${body}</main></body></html>`;

before(async () => {
    other = createServer((request, response) => {
        otherRequests.push(`${request.method} ${request.url}`);
        response.writeHead(200, { "content-type": "text/html" }).end(html("<h1>Elsewhere</h1>"));
    });
    otherOrigin = await listen(other);
    site = createServer((request, response) => {
        const shared = `<p><a href="/ok">Shared</a></p>`;
        if (request.url === "/") return response.writeHead(200, { "content-type": "text/html" }).end(html(`<h1>Home</h1><p><a href="/ok">Working</a></p><p><a href="/missing">Broken</a></p><p><a href="${otherOrigin}/page">External</a></p>${shared}`));
        if (request.url === "/ok") return response.writeHead(200, { "content-type": "text/html" }).end(html(`<h1>OK</h1>${shared}<p><a href="/">Back home</a></p>`));
        response.writeHead(404, { "content-type": "text/html" }).end(html("<h1>Not found</h1>"));
    });
    origin = await listen(site);
});

after(async () => {
    await new Promise((resolve) => site?.close(resolve));
    await new Promise((resolve) => other?.close(resolve));
});

async function runSpec(code: string, label: string, grep?: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `link-inventory-${label}`, ["--timeout=30000", "--workers=1", ...(grep ? [`--grep=${grep}`] : [])], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

const one = (records: ExecutionRecord[], title: RegExp) => {
    const found = records.filter((record) => title.test(record.title));
    assert.equal(found.length, 1, `${title}: ${found.length} in ${records.map((record) => `${record.title} [${record.status}]`).join(" | ")}`);
    return found[0];
};

let profile: ContentProfile;
async function fixtureProfile() {
    profile ??= normalizeContentProfile({ scannedAt: new Date().toISOString(), baseUrl: origin, ...(await inspectPages(origin, ["/", "/ok"])) }) as ContentProfile;
    return profile;
}

test("in a real browser: one test per distinct link, the repeated one once; the working link passes and the broken one fails in link health, with no load twice (TFP-205)", { skip: needsChromium }, async () => {
    const inspected = await fixtureProfile();
    const code = mockGenerate(origin, "Check the site.", ["functional"], inspected, normalizeContentRules({ paths: ["/", "/ok"] }), normalizeTestAuditMode("fast"));
    assert.deepEqual(findTypeErrors(code), []);
    const titles = parseTestUnits(code).map((unit) => unit.title).filter(isInventory);
    // Working, Broken, External and Shared on /, then Back home on /ok: Shared is one test.
    assert.equal(titles.length, 5, titles.join(" | "));
    assert.equal(titles.filter((title) => title.includes('"Shared"')).length, 1);
    assert.ok(titles.find((title) => title.includes('"Shared"'))!.endsWith('"Shared" on /: on the page, named, with a valid href'));
    assert.ok(code.includes("// Its target: loaded by the link-health check."), "a same-origin target is link health's to load");
    assert.ok(code.includes("// Its target: external: its href only, no request."));
    assert.ok(!code.includes("Its target, same-origin and loaded by no other check"), "nothing is loaded twice");
    // The coverage map counts every link covered in context.
    assert.deepEqual(untouched(buildCoverageMap(inspected, code)!).filter((entry) => entry.kind === "link").map((entry) => entry.name), []);

    // The link tests alone: each passes, and none sends the external link's origin a request.
    otherRequests.length = 0;
    const records = await runSpec(code, "generated", 'link "');
    for (const name of ["Working", "Broken", "External", "Shared", "Back home"]) assert.equal(one(records, new RegExp(`link "${name}" on`)).status, "Passed", name);
    assert.deepEqual(otherRequests, [], "no request to the external link's origin");
    // Link health, unchanged, is what loads the same-origin targets: it fails on the broken one, naming it.
    const health = (await runSpec(code, "health", "link health: internal, external")).filter((record) => record.title.includes("link health: internal, external"));
    assert.ok(health.some((record) => record.status === "Failed" && /Broken link detected for Broken/.test(record.rawMessage)), health.map((record) => record.rawMessage).join(" | "));
});

test("in a real browser: a link no other check loads is loaded by its own test - a broken one fails with its status, an external one gets no request, one over the cap is named (TFP-205)", { skip: needsChromium }, async () => {
    const inspected = await fixtureProfile();
    // As if no site-wide check loaded the targets, with room for 2 loads.
    const built = buildLinkInventoryTests(inspected, undefined, { loadCap: 2, reused: (link) => (link.linkType === "external" ? "external: its href only, no request" : null) });
    assert.equal(built.usesGuard, true);
    const code = `import { test, expect } from '@playwright/test';\n\ntest.use({ baseURL: '${origin}' });\n\n${READ_ONLY_GUARD_HELPER}\n\ntest.describe('Functional', () => {\n${built.tests.join("\n\n")}\n});\n`;
    assert.deepEqual(findTypeErrors(code), []);
    otherRequests.length = 0;
    const records = await runSpec(code, "loads");
    assert.equal(one(records, /link "Working" on/).status, "Passed");
    const broken = one(records, /link "Broken" on/);
    assert.equal(broken.status, "Failed");
    assert.match(broken.rawMessage, /"Broken" leads to \/missing, which answers 404/);
    assert.equal(one(records, /link "External" on/).status, "Passed");
    assert.deepEqual(otherRequests, [], "no request to the external link's origin");
    // Working and Broken took the 2 loads; Shared, the next same-origin one, is over the cap.
    const shared = one(records, /link "Shared" on/);
    assert.equal(shared.status, "Passed");
    assert.ok((shared.findings ?? []).some((finding) => /"Shared": its target \(\/ok\) was not loaded, over this run's cap of 2 link-target loads/.test(finding)), JSON.stringify(shared.findings));
});

test("offline, on TFP-197's crawls of both Toolshop copies: generation leaves no link on the in-context gap list (TFP-205)", () => {
    for (const copy of ["clean", "with-bugs"]) {
        const crawl = JSON.parse(readFileSync(join(process.cwd(), `benchmarks/2026-10-15-tfp197-gap-writer/runs/${copy}-crawl.json`), "utf8")) as { result: { pageSelection: { standard: { pages: string[] } } } };
        const selected = crawl.result.pageSelection.standard.pages;
        const inspected = normalizeContentProfile(JSON.parse(readFileSync(join(process.cwd(), `benchmarks/2026-10-13-tfp188/runs/${copy}-standard-profile.json`), "utf8"))) as ContentProfile;
        // The same pages; clean's product id changes each time its database is seeded.
        const sameType = (path: string) => path.replace(/\/product\/[^/]+$/, "/product/:id");
        assert.deepEqual(inspected.pages.map((page) => sameType(page.path)), selected.map(sameType), `${copy}: TFP-197's selection is Gate B's inspected pages`);
        const code = mockGenerate(inspected.baseUrl, "Check the site.", AREAS, inspected, normalizeContentRules({ paths: inspected.pages.map((page) => page.path) }), normalizeTestAuditMode("fast"));
        const map = buildCoverageMap(inspected, code)!;
        const links = map.entries.filter((entry) => entry.kind === "link");
        assert.ok(links.length > 30, `${copy}: ${links.length} distinct links`);
        assert.deepEqual(untouched(map).filter((entry) => entry.kind === "link").map((entry) => `${entry.page}: ${entry.name}`), [], `${copy}: no link left on the gap list`);
        assert.equal(parseTestUnits(code).filter((unit) => isInventory(unit.title)).length, links.length, `${copy}: one test per distinct link`);
    }
});
