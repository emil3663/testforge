// Phase 35 TFP-137: runs one ref's template generator on the fixed inputs.
// Started by check-template-unchanged.mjs in its own Node process, with that
// ref's own TS resolver, so every import - relative or "@/" - resolves inside
// the ref's extracted src/. The inputs and the content profile come from the
// working tree, so both sides run exactly the same inputs.
//
// Usage: node --import <ref>/scripts/register-node-test-ts-resolver.mjs
//   --experimental-strip-types generate.mjs <refRoot> <workTreeRoot> <outFile>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CheckError, MOCK_GENERATE_ARITY, requireArity, requireExports } from "./compare.mjs";
import { buildInputs, CONTENT_PROFILE_PATH } from "./inputs.mjs";

const [refRoot, workTree, outFile] = process.argv.slice(2);

try {
    const mock = await import(pathToFileURL(join(refRoot, "src/lib/generate/mock/index.ts")).href);
    const normalize = await import(pathToFileURL(join(refRoot, "src/lib/generate/normalize.ts")).href);
    requireExports("src/lib/generate/mock/index.ts", mock, ["mockGenerate"]);
    requireExports("src/lib/generate/normalize.ts", normalize, ["normalizeContentRules", "normalizeTestAuditMode"]);
    requireArity("mockGenerate", mock.mockGenerate, MOCK_GENERATE_ARITY);

    const rawProfile = JSON.parse(readFileSync(join(workTree, CONTENT_PROFILE_PATH), "utf8"));
    // normalizeContentProfile where the ref has it, as the route would apply it.
    const profile = typeof normalize.normalizeContentProfile === "function" ? normalize.normalizeContentProfile(rawProfile) : rawProfile;

    const outputs = {};
    for (const input of buildInputs()) {
        outputs[input.key] = mock.mockGenerate(
            input.baseUrl,
            input.description,
            input.practices,
            input.pageData ? profile : null,
            normalize.normalizeContentRules(undefined),
            normalize.normalizeTestAuditMode(input.mode)
        );
    }
    writeFileSync(outFile, JSON.stringify(outputs, null, 1));
} catch (error) {
    process.stderr.write(`${error instanceof CheckError ? "" : "unexpected error: "}${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
}
