// TFP-176: re-measure each site's page types from the crawl already committed
// beside this script (no new crawl), with the grouping as revised at Gate A.
// The crawl results list pages sorted by path, so types come out in that
// order; their pages don't depend on it. --out=<suffix> names the result
// files (default tfp176); TFP-176's follow-up writes tfp176-parent beside the
// second measurement's files, which stay.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> [--out=<suffix>] <site>...
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dir = join(root, "benchmarks", "2026-10-07-phase40-types");
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { groupPagesByAddress, groupPagesIntoTypes, labelPageType } = await load("src/lib/selection/page-types.ts");

const args = process.argv.slice(2);
const suffix = args.find((arg) => arg.startsWith("--out="))?.slice("--out=".length) ?? "tfp176";
for (const site of args.filter((arg) => !arg.startsWith("--out="))) {
    const crawl = JSON.parse(await readFile(join(dir, `${site}-crawl.json`), "utf8"));
    type Page = { path: string; outline?: { forms: string[][] } };
    const pages: Page[] = crawl.result.pages;
    const outlines = new Map(pages.map((page) => [page.path, page.outline]));
    // The start page is the crawl's base URL: its start route on a hash-routed site (/#/), else its path.
    const basePath = new URL(crawl.result.baseUrl).pathname.replace(/\/$/, "") || "/";
    const names = new Set(pages.map((page) => page.path));
    const startPath = [`${basePath === "/" ? "" : basePath}/#/`, basePath].find((name) => names.has(name)) ?? pages[0].path;
    const types = groupPagesIntoTypes(pages.map((page) => ({ path: page.path, outline: page.outline })))
        .map((type: { pages: string[] }) => ({ ...type, label: labelPageType(type as never, outlines.get(type.pages[0]) as never, startPath) }));
    const summary = {
        site,
        from: `${site}-crawl.json (crawled ${crawl.result.crawledAt})`,
        pages: pages.length,
        addressTypes: groupPagesByAddress(pages.map((page) => page.path)).length,
        types: types.length,
        typeList: types.map((type: { label: string; pattern: string; pages: string[]; formSignature: string }) => ({ label: type.label, pattern: type.pattern, count: type.pages.length, forms: type.formSignature, pages: type.pages })),
    };
    await writeFile(join(dir, `${site}-types-${suffix}.json`), JSON.stringify(summary, null, 2) + "\n");
    console.log(`${site}: ${summary.pages} pages; address types ${summary.addressTypes}; types ${summary.types}`);
    for (const type of summary.typeList) console.log(`   ${type.label.padEnd(8)} ${String(type.count).padStart(3)}  ${type.pattern.padEnd(44)} ${type.forms}`);
}
