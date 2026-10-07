// TFP-175: crawl a site through the app's own crawl route (read-only, one
// browser, as the UI's crawl does) and keep the automatic selection the app
// would use: Standard's one page per type up to 8, and Comprehensive's 20
// pages (Phase 40 Decisions 4 to 6, as built in TFP-172 and 967ad6c).
// Writes <label>-crawl.json (the whole crawl, with its ranking and both
// selections) and <label>-selection.json (the pages, for the run driver).
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <outDir>
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { POST, GET } = await load("src/app/api/crawl/route.ts");
const { NextRequest } = await import("next/server");

const [label, site, outDir] = process.argv.slice(2);
const started = Date.now();
const first = await (await POST(new NextRequest(new URL("http://localhost/api/crawl"), { method: "POST", body: JSON.stringify({ baseUrl: site }) }))).json();
let crawl = first;
while (crawl.crawlStatus === "running") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    crawl = await (await GET(new NextRequest(new URL(`http://localhost/api/crawl?crawlId=${first.crawlId}`)))).json();
}
const seconds = Math.round((Date.now() - started) / 1000);
await writeFile(join(outDir, `${label}-crawl.json`), JSON.stringify(crawl, null, 2) + "\n");

type Typed = { pattern: string; label: string; pages: string[]; representative: string; reason?: string; selected?: string[]; placement: string };
const selection = crawl.result?.pageSelection;
const summary = {
    label,
    site,
    commit: process.env.MEASURE_COMMIT ?? "?",
    crawledAt: crawl.result?.crawledAt,
    status: crawl.crawlStatus,
    seconds,
    pages: crawl.result?.pageCount,
    warnings: crawl.result?.warnings ?? [],
    types: (crawl.result?.rankedTypes ?? []).map((type: Typed & { rank: number }) => ({ rank: type.rank, label: type.label, pattern: type.pattern, pages: type.pages.length, representative: type.representative, placement: type.placement })),
    standard: { pages: selection?.standard.pages ?? [], skipped: (selection?.standard.skipped ?? []).map((type: Typed) => ({ pattern: type.pattern, label: type.label, reason: type.reason })) },
    comprehensive: { pages: selection?.comprehensive.pages ?? [], skipped: (selection?.comprehensive.skipped ?? []).map((type: Typed) => ({ pattern: type.pattern, label: type.label, reason: type.reason })) },
};
await writeFile(join(outDir, `${label}-selection.json`), JSON.stringify(summary, null, 2) + "\n");
console.log(`${label}: ${summary.status}, ${summary.pages} pages, ${summary.types.length} types in ${seconds} s`);
console.log(`  standard (${summary.standard.pages.length}): ${summary.standard.pages.join(" ")}`);
console.log(`  skipped: ${summary.standard.skipped.map((type: { pattern: string }) => type.pattern).join(" ")}`);
console.log(`  comprehensive (${summary.comprehensive.pages.length}): ${summary.comprehensive.pages.join(" ")}`);
