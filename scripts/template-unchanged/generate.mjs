// Phase 35 TFP-137: runs one ref's template generator on the fixed inputs.
// Started by check-template-unchanged.mjs in its own Node process, with that
// ref's own TS resolver, so every import - relative or "@/" - resolves inside
// the ref's extracted src/. The inputs and the content profile come from the
// working tree, so both sides run exactly the same inputs.
//
// Usage: node --import <ref>/scripts/register-node-test-ts-resolver.mjs
//   --experimental-strip-types generate.mjs <refRoot> <workTreeRoot> <outFile>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CheckError, COMPREHENSIVE_SUITE_ARITY, MOCK_GENERATE_ARITY, requireArity, requireExports, SELECT_PAGES_ARITY } from "./compare.mjs";
import { CONTENT_PROFILE_PATH } from "./inputs.mjs";
import { generateOutputs } from "./outputs.mjs";

const [refRoot, workTree, outFile] = process.argv.slice(2);

try {
    const mock = await import(pathToFileURL(join(refRoot, "src/lib/generate/mock/index.ts")).href);
    const normalize = await import(pathToFileURL(join(refRoot, "src/lib/generate/normalize.ts")).href);
    requireExports("src/lib/generate/mock/index.ts", mock, ["mockGenerate"]);
    requireExports("src/lib/generate/normalize.ts", normalize, ["normalizeContentRules", "normalizeTestAuditMode"]);
    requireArity("mockGenerate", mock.mockGenerate, MOCK_GENERATE_ARITY);
    // TFP-258: Comprehensive's generator too, so its helpers are covered. A ref from before it (134b183) stops here by name.
    const comprehensiveFiles = ["src/lib/generate/comprehensive.ts", "src/lib/comprehensive/pages.ts", "src/lib/comprehensive/run-mode.ts"];
    const absent = comprehensiveFiles.filter((file) => !existsSync(join(refRoot, file)));
    if (absent.length > 0) throw new CheckError(`${absent.join(", ")} missing at this ref: it is from before Comprehensive runs (134b183), which the check runs too since TFP-258`);
    const [comprehensive, pages, runMode] = await Promise.all(comprehensiveFiles.map((file) => import(pathToFileURL(join(refRoot, file)).href)));
    requireExports("src/lib/generate/comprehensive.ts", comprehensive, ["buildComprehensiveSuite"]);
    requireExports("src/lib/comprehensive/pages.ts", pages, ["selectComprehensivePages"]);
    requireExports("src/lib/comprehensive/run-mode.ts", runMode, ["normalizeRunMode"]);
    requireArity("buildComprehensiveSuite", comprehensive.buildComprehensiveSuite, COMPREHENSIVE_SUITE_ARITY);
    requireArity("selectComprehensivePages", pages.selectComprehensivePages, SELECT_PAGES_ARITY);

    const rawProfile = JSON.parse(readFileSync(join(workTree, CONTENT_PROFILE_PATH), "utf8"));
    writeFileSync(outFile, JSON.stringify(generateOutputs({ mock, normalize, comprehensive, pages, runMode }, rawProfile), null, 1));
} catch (error) {
    process.stderr.write(`${error instanceof CheckError ? "" : "unexpected error: "}${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
}
