// TFP-171: crawl a site through the app's crawl route (read-only, one browser,
// as the UI's crawl does) and record its page types: by address only
// (Decision 1), by address and outline (Decision 2), and by Decision 2's
// narrow reading of field types (password, email, textarea, search only).
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <outDir>
// <site> "fixture" or "fixture:/types" starts the comparison fixture.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { POST, GET } = await load("src/app/api/crawl/route.ts");
const { NextRequest } = await import("next/server");
const { groupPagesByAddress, groupPagesIntoTypes } = await load("src/lib/selection/page-types.ts");
const { narrowSignatureOf } = await load("src/lib/selection/page-outline.ts");
const { startRecordedFixture } = await load("src/test-support/comparison-fixture.ts");

const [label, site, outDir] = process.argv.slice(2);
let fixture: { origin: string; close: () => Promise<void> } | null = null;
let baseUrl = site;
if (site.startsWith("fixture")) {
    fixture = await startRecordedFixture();
    baseUrl = fixture!.origin + (site.split(":")[1] ?? "");
}

const started = Date.now();
const first = await (await POST(new NextRequest(new URL("http://localhost/api/crawl"), { method: "POST", body: JSON.stringify({ baseUrl }) }))).json();
let crawl = first;
while (crawl.crawlStatus === "running") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    crawl = await (await GET(new NextRequest(new URL(`http://localhost/api/crawl?crawlId=${first.crawlId}`)))).json();
}
const seconds = Math.round((Date.now() - started) / 1000);
await fixture?.close();

type Page = { path: string; outline?: { forms: string[][] } };
const pages: Page[] = crawl.result?.pages ?? [];
// The recorded types were computed in discovery order; the result's pages are sorted for display.
const types = crawl.result?.pageTypes ?? [];
const address = groupPagesByAddress(pages.map((page) => page.path));
const narrow = groupPagesIntoTypes(pages.map((page) => ({ path: page.path, signature: page.outline ? narrowSignatureOf(page.outline as never) : undefined })));
const withoutOutline = pages.filter((page) => !page.outline).map((page) => page.path);

const auth = types.filter((type: { patterns: string[] }) => type.patterns.some((pattern) => /\/auth\/:slug$/.test(pattern)));
const summary = {
    label,
    site: baseUrl,
    crawledAt: crawl.result?.crawledAt,
    status: crawl.crawlStatus,
    seconds,
    pages: pages.length,
    warnings: crawl.result?.warnings ?? [],
    pagesWithoutOutline: withoutOutline,
    addressTypes: address.length,
    types: types.length,
    narrowReadingTypes: narrow.length,
    authSplit: auth.length > 0 ? auth.map((type: { label: string; pages: string[] }) => `${type.label}: ${type.pages.join(", ")}`) : null,
    typeList: types.map((type: { label: string; pattern: string; pages: string[]; signature: string }) => ({ label: type.label, pattern: type.pattern, count: type.pages.length, pages: type.pages, signature: type.signature })),
};
await writeFile(join(outDir, `${label}-crawl.json`), JSON.stringify(crawl, null, 2) + "\n");
await writeFile(join(outDir, `${label}-types.json`), JSON.stringify(summary, null, 2) + "\n");
console.log(`${label}: ${summary.status}, ${summary.pages} pages in ${seconds} s; address types ${summary.addressTypes}, outline types ${summary.types} (narrow reading ${summary.narrowReadingTypes}); pages without an outline ${withoutOutline.length}`);
for (const type of summary.typeList) console.log(`   ${type.label.padEnd(8)} ${String(type.count).padStart(3)}  ${type.pattern}`);
if (summary.authSplit) console.log(`   /auth/:slug -> ${summary.authSplit.join(" | ")}`);
