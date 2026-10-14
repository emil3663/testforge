// Phase 42 (TFP-193): what the generators write, before and after Phase 41's checks moved into the library.
// Standard (all ten areas, fast and deep) and Comprehensive (every area, its page selection) on two page-data
// inputs: the clean local Toolshop's (benchmarks/2026-10-14-tfp201-two-tiers/runs/clean-profile.json) and the
// comparison fixture's pages that Phase 41's checks need (fixture-profile.json here, inspected once with
// "inspect"). Both sides read the same files, so a difference is the code's.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> inspect
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> write <outFile>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const here = "benchmarks/2026-10-14-tfp193-library";
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const [command, outFile] = process.argv.slice(2);

if (command === "inspect") {
    const { startRecordedFixture } = await load("src/test-support/comparison-fixture.ts");
    const { inspectPages } = await load("src/lib/introspect/inspector.ts");
    const fixture = await startRecordedFixture();
    try {
        const paths = ["/", "/store", "/store/item/01J8Z3K4QWHAMMER", "/store/register", "/forms", "/controls", "/gallery", "/gallery/more", "/words", "/wrapped"];
        const inspection = await inspectPages(fixture.origin, paths);
        writeFileSync(join(root, here, "fixture-profile.json"), JSON.stringify({ scannedAt: "fixed", baseUrl: fixture.origin, ...inspection }, null, 1));
    } finally {
        await fixture.close();
    }
} else if (command === "write") {
    const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
    const { normalizeContentProfile, normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");
    const { buildComprehensiveSuite } = await load("src/lib/generate/comprehensive.ts");
    const { selectComprehensivePages } = await load("src/lib/comprehensive/pages.ts");
    const { normalizeRunMode, COMPREHENSIVE_AREAS } = await load("src/lib/comprehensive/run-mode.ts");
    const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
    const inputs = [
        { name: "toolshop", file: "benchmarks/2026-10-14-tfp201-two-tiers/runs/clean-profile.json", baseUrl: "http://localhost:4200" },
        { name: "fixture", file: join(here, "fixture-profile.json"), baseUrl: "" },
    ];
    const outputs: Record<string, string> = {};
    for (const input of inputs) {
        const raw = JSON.parse(readFileSync(join(root, input.file), "utf8"));
        const baseUrl = input.baseUrl || raw.baseUrl;
        const profile = normalizeContentProfile(raw);
        for (const mode of ["fast", "deep"]) {
            outputs[`${input.name} standard ${mode}`] = mockGenerate(baseUrl, "Check the site.", AREAS, profile, normalizeContentRules({ paths: profile.pages.map((page: { path: string }) => page.path) }), normalizeTestAuditMode(mode));
        }
        for (const area of COMPREHENSIVE_AREAS) {
            const runMode = normalizeRunMode({ kind: "comprehensive", area });
            outputs[`${input.name} comprehensive ${area}`] = buildComprehensiveSuite(baseUrl, runMode, selectComprehensivePages(profile, baseUrl, runMode.pageCap));
        }
    }
    writeFileSync(outFile, JSON.stringify(outputs, null, 1));
    console.log(`${Object.keys(outputs).length} outputs: ${Object.entries(outputs).map(([key, code]) => `${key} ${code.length}`).join("; ")}`);
} else {
    throw new Error("usage: inspect | write <outFile>");
}
