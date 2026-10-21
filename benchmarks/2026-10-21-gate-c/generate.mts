// Phase 39 Gate C: one variant's suites, from the session's one inspection, as Gate B's generate.mts (unchanged but
// for the axe order). Run with the variant's worktree as the working directory, so its own generator writes them.
// Writes <outDir>/<label>-<kind>-suite.spec.ts for each kind asked for: Standard (all ten areas, fast) on Standard's
// pages; Comprehensive accessibility on Comprehensive's, cap 20.
// <axeOrder> (optional): "last" for the variant with the axe scan after the checks that change the page (TFP-214's
// switch, Emil 2026-10-21); only F's code has the switch.
// Usage (cwd = the variant's worktree): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <inputDir> <outDir> <kinds> [<axeOrder>]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");
const { buildComprehensiveSuite } = await load("src/lib/generate/comprehensive.ts");
const { normalizeRunMode } = await load("src/lib/comprehensive/run-mode.ts");

const [label, site, inputDir, outDir, kinds, axeOrder] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
const selection = JSON.parse(await readFile(join(inputDir, `${label}-selection.json`), "utf8"));
const profile = JSON.parse(await readFile(join(inputDir, `${label}-standard-profile.json`), "utf8"));
const options = axeOrder ? { axeOrder } : {};
await mkdir(outDir, { recursive: true });
for (const kind of kinds.split(",")) {
    const code = kind === "standard"
        ? mockGenerate(origin, "Check the site.", AREAS, profile, normalizeContentRules({ paths: selection.standard.pages }), normalizeTestAuditMode("fast"))
        : buildComprehensiveSuite(origin, normalizeRunMode({ kind: "comprehensive", area: kind }), { covered: selection.comprehensive.pages, notCovered: [], pageCap: 20 }, options);
    await writeFile(join(outDir, `${label}-${kind}-suite.spec.ts`), code, "utf8");
    console.log(`${label}: ${kind} suite from ${root}${axeOrder ? ` (axe order: ${axeOrder})` : ""}`);
}
