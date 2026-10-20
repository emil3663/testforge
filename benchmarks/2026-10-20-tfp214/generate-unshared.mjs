// TFP-214: one ref's template output on check:template-unchanged's 166 fixed inputs, with the shared-visit pass off
// ({ sharedVisits: false }, there since TFP-212). Started by verify-template.mts in its own Node process, with that
// ref's own TS resolver, as scripts/template-unchanged/generate.mjs is.
// Usage: node --import <ref>/scripts/register-node-test-ts-resolver.mjs --experimental-strip-types generate-unshared.mjs <refRoot> <workTreeRoot> <outFile>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [refRoot, workTree, outFile] = process.argv.slice(2);
const { buildInputs, CONTENT_PROFILE_PATH } = await import(pathToFileURL(join(workTree, "scripts/template-unchanged/inputs.mjs")).href);
const mock = await import(pathToFileURL(join(refRoot, "src/lib/generate/mock/index.ts")).href);
const normalize = await import(pathToFileURL(join(refRoot, "src/lib/generate/normalize.ts")).href);
const rawProfile = JSON.parse(readFileSync(join(workTree, CONTENT_PROFILE_PATH), "utf8"));
const profile = typeof normalize.normalizeContentProfile === "function" ? normalize.normalizeContentProfile(rawProfile) : rawProfile;
const outputs = {};
for (const input of buildInputs()) {
    const args = [input.baseUrl, input.description, input.practices, input.pageData ? profile : null, normalize.normalizeContentRules(undefined), normalize.normalizeTestAuditMode(input.mode)];
    outputs[input.key] = { shared: mock.mockGenerate(...args), unshared: mock.mockGenerateDetailed(...args, { sharedVisits: false }).code };
}
writeFileSync(outFile, JSON.stringify(outputs, null, 1));
