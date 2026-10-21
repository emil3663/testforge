// Phase 39 Gate D (TFP-158): one variant's suites. As Gate C's generate.mts, with two additions:
// - Comprehensive security as a kind, beside Standard and Comprehensive accessibility (Decision 13 judges
//   Comprehensive, every area: security and accessibility, COMPREHENSIVE_AREAS);
// - <inspectPaths> (optional, comma-separated): inspect those paths with this tree's own inspector and generate
//   Standard on them, as Phase 38's TFP-150 did (measure-standard-run.ts): its before and after (d90de57, d202315)
//   each inspect with their own code. Without it, the session's one inspection is used, as at Gates B and C.
// Run with the variant's tree as the working directory, so its own generator writes them.
// Writes <outDir>/<label>-<kind>-suite.spec.ts for each kind asked for: Standard (all ten areas, fast) on Standard's
// pages; Comprehensive security (passive) and accessibility on Comprehensive's, cap 20.
// Usage (cwd = the variant's tree): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <inputDir> <outDir> <kinds> [<inspectPaths>]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");

const [label, site, inputDir, outDir, kinds, inspectPaths] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
await mkdir(outDir, { recursive: true });

let standardPages: string[];
let profile: unknown;
if (inspectPaths) {
    const { inspectPages } = await load("src/lib/introspect/inspector.ts");
    standardPages = inspectPaths.split(",");
    profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...(await inspectPages(origin, standardPages)) };
    await writeFile(join(outDir, `${label}-standard-profile.json`), JSON.stringify(profile, null, 2), "utf8");
} else {
    standardPages = JSON.parse(await readFile(join(inputDir, `${label}-selection.json`), "utf8")).standard.pages;
    profile = JSON.parse(await readFile(join(inputDir, `${label}-standard-profile.json`), "utf8"));
}

for (const kind of kinds.split(",")) {
    let code: string;
    if (kind === "standard") {
        code = mockGenerate(origin, "Check the site.", AREAS, profile, normalizeContentRules({ paths: standardPages }), normalizeTestAuditMode("fast"));
    } else {
        const { buildComprehensiveSuite } = await load("src/lib/generate/comprehensive.ts");
        const { normalizeRunMode } = await load("src/lib/comprehensive/run-mode.ts");
        const selection = JSON.parse(await readFile(join(inputDir, `${label}-selection.json`), "utf8"));
        code = buildComprehensiveSuite(origin, normalizeRunMode({ kind: "comprehensive", area: kind }), { covered: selection.comprehensive.pages, notCovered: [], pageCap: 20 });
    }
    await writeFile(join(outDir, `${label}-${kind}-suite.spec.ts`), code, "utf8");
    console.log(`${label}: ${kind} suite from ${root}${inspectPaths ? ` (its own inspection of ${standardPages.join(" ")})` : ""}`);
}
