// TFP-154 step 1: crawl and inspect a site through the app's own API, the
// way the UI does (useCrawl.ts selects every crawled path; /api/introspect
// keeps the first 5). Read-only: page loads only. Nothing is generated or run.
// Usage: node crawl-and-inspect.mjs <app origin> <site url> <label> <out dir>
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const [app, site, label, outDir] = process.argv.slice(2);
const post = (path, body) => fetch(`${app}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

const started = Date.now();
let crawl = await post("/api/crawl", { baseUrl: site });
while (crawl.crawlStatus === "running") {
    await new Promise((r) => setTimeout(r, 2000));
    crawl = await fetch(`${app}/api/crawl?crawlId=${crawl.crawlId}`).then((r) => r.json());
}
await writeFile(join(outDir, `${label}-crawl.json`), JSON.stringify(crawl, null, 2) + "\n");
const crawledPaths = (crawl.result?.pages ?? []).map((page) => page.path);

const inspectStarted = Date.now();
const inspection = await post("/api/introspect", { baseUrl: site, paths: crawledPaths });
await writeFile(join(outDir, `${label}-inspection.json`), JSON.stringify(inspection, null, 2) + "\n");

const hashLinks = (inspection.pages ?? []).flatMap((page) => (page.linkDetails ?? [])
    .filter((link) => link.rawHref.startsWith("#"))
    .map((link) => ({ page: page.path, text: link.text, rawHref: link.rawHref, url: link.url, linkType: link.linkType })));
console.log(JSON.stringify({
    label,
    site,
    crawl: { status: crawl.crawlStatus, seconds: Math.round((inspectStarted - started) / 1000), pageCount: crawl.result?.pageCount, paths: crawledPaths, warnings: crawl.result?.warnings },
    inspection: {
        seconds: Math.round((Date.now() - inspectStarted) / 1000),
        requestedPaths: inspection.requestedPaths,
        failedPages: inspection.failedPages,
        pages: (inspection.pages ?? []).map((page) => ({ path: page.path, url: page.url, title: page.title, links: page.linkDetails?.length ?? 0, elements: page.actionableElements?.length ?? 0 })),
        warnings: inspection.warnings,
    },
    hashLinks: { count: hashLinks.length, linkTypes: [...new Set(hashLinks.map((link) => link.linkType))], sample: hashLinks.slice(0, 12) },
}, null, 2));
