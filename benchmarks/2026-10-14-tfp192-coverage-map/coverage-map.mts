// Phase 42 (TFP-192): the coverage map of Standard's suite on one local Toolshop copy. Generates through the
// app's own generate route (all ten areas, fast, the given pages inspected first, as the app does), with a
// temporary data folder, then builds the map from the suite and the inspected pages. Nothing is run: the map
// is read from the suite's code. Writes <label>-coverage-map.json (the whole map) and <label>-uncovered.txt
// (per page type, covered of total, then each item no test touches); from TFP-201 also <label>-suite.spec.ts
// and <label>-profile.json, the inputs the map is read from.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <outDir> <path>...
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dataDir = mkdtempSync(join(tmpdir(), "testforge-tfp192-"));
process.env.TESTFORGE_DATA_DIR = dataDir;
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { POST } = await load("src/app/api/generate/route.ts");
const { NextRequest } = await import("next/server");
const { loadSiteSuiteProfile } = await load("src/lib/site-suites/store.ts");
const { buildCoverageMap } = await load("src/lib/report/coverage-map.ts");
const { describeCoverageMap, describeCoverageMapType } = await load("src/lib/report/coverage-map-text.ts");

const [label, site, outDir, ...paths] = process.argv.slice(2);
const notPaths = paths.filter((path) => !path.startsWith("/"));
if (notPaths.length > 0) throw new Error(`not page paths, refusing to run: ${notPaths.join(", ")}`);
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
await mkdir(outDir, { recursive: true });
try {
    const response = await POST(new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: JSON.stringify({ baseUrl: site, description: "Check the site.", selectedPractices: AREAS, auditMode: "fast", contentRules: { paths } }),
        headers: { "content-type": "application/json" },
    }));
    const body = await response.json();
    if (response.status !== 200 || !body.siteSuite) throw new Error(`generate answered ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
    const profile = await loadSiteSuiteProfile(body.siteSuite.store);
    const map = buildCoverageMap(profile, body.code);
    // TFP-201: the suite and the page data too, so the map can be read again from them.
    await writeFile(join(outDir, `${label}-suite.spec.ts`), body.code, "utf8");
    await writeFile(join(outDir, `${label}-profile.json`), JSON.stringify(profile), "utf8");
    if (!map) throw new Error("no coverage map: no page data");
    await writeFile(join(outDir, `${label}-coverage-map.json`), JSON.stringify({ commit: process.env.MEASURE_COMMIT ?? null, site, paths, pageInspection: body.pageInspection, map }, null, 2), "utf8");
    const lines = [`${label} (${process.env.MEASURE_COMMIT ?? "uncommitted"}): ${describeCoverageMap(map)}`, ""];
    for (const type of map.types) {
        lines.push(`${type.pattern}: ${describeCoverageMapType(type)}`);
        for (const item of type.uncovered) lines.push(`  not checked in context: ${item}`);
    }
    await writeFile(join(outDir, `${label}-uncovered.txt`), `${lines.join("\n")}\n`, "utf8");
    console.log(lines.join("\n"));
} finally {
    rmSync(dataDir, { recursive: true, force: true });
}
