// The Gate C ruling (Emil, 2026-10-21): the axe scan runs last in each page's group by default. This shows that the
// order is the only change to the template's output: for check:template-unchanged's 166 fixed inputs,
// - this code with `axeOrder: "before-changes"` (the old default) gives the base's output, byte for byte;
// - this code's default gives the head's output (the check's own generation), byte for byte.
// Usage (from the repo root, after `npm run check:template-unchanged -- <base>`; the head is the working tree):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-axe-last/verify-template.mts <comparisonDir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const load = (path: string) => import(pathToFileURL(join(process.cwd(), path)).href);
const { mockGenerate, mockGenerateDetailed } = await load("src/lib/generate/mock/index.ts");
const normalize = await load("src/lib/generate/normalize.ts");
const { buildInputs, CONTENT_PROFILE_PATH } = await load("scripts/template-unchanged/inputs.mjs");
const dir = process.argv[2];
const base = JSON.parse(readFileSync(join(dir, "base.json"), "utf8")) as Record<string, string>;
const head = JSON.parse(readFileSync(join(dir, "head.json"), "utf8")) as Record<string, string>;
const rawProfile = JSON.parse(readFileSync(join(process.cwd(), CONTENT_PROFILE_PATH), "utf8"));
const profile = typeof normalize.normalizeContentProfile === "function" ? normalize.normalizeContentProfile(rawProfile) : rawProfile;
let oldOrder = 0, newOrder = 0, changed = 0;
for (const input of buildInputs()) {
    const args = [input.baseUrl, input.description, input.practices, input.pageData ? profile : null, normalize.normalizeContentRules(undefined), normalize.normalizeTestAuditMode(input.mode)];
    if (mockGenerateDetailed(...args, { axeOrder: "before-changes" }).code === base[input.key]) oldOrder++;
    else console.log(`the old order is not the base's: ${input.key}`);
    if (mockGenerate(...args) === head[input.key]) newOrder++;
    else console.log(`the default is not the head's: ${input.key}`);
    if (base[input.key] !== head[input.key]) changed++;
}
console.log(`166 inputs: with axeOrder "before-changes", ${oldOrder} are the base's byte for byte; by default, ${newOrder} are the head's; ${changed} differ between base and head`);
