// TFP-212 and TFP-215: the template's output changes on purpose - the shared-visit pass. This shows it is the only
// change: for each of check:template-unchanged's 166 fixed inputs, the base's output (961f0d8, the baseline before)
// put through shareReadOnlyVisits is the head's output, byte for byte.
// Usage (from the repo root, after `npm run check:template-unchanged -- 961f0d8 <head>`):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-tfp212/verify-template.mts <comparisonDir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { shareReadOnlyVisits } = await import(pathToFileURL(join(process.cwd(), "src/lib/generate/shared-visits.ts")).href);
const dir = process.argv[2];
const base = JSON.parse(readFileSync(join(dir, "base.json"), "utf8"));
const head = JSON.parse(readFileSync(join(dir, "head.json"), "utf8"));
const entries = (outputs: unknown) => (Array.isArray(outputs) ? outputs.map((output, index) => [String(index), output]) : Object.entries(outputs as Record<string, unknown>)) as Array<[string, unknown]>;
const heads = new Map(entries(head));
let same = 0, shared = 0, other = 0;
for (const [key, output] of entries(base)) {
    const code = typeof output === "string" ? output : (output as { code: string }).code;
    const after = heads.get(key);
    const headCode = typeof after === "string" ? after : (after as { code: string }).code;
    if (code === headCode) same++;
    else if (shareReadOnlyVisits(code) === headCode) shared++;
    else { other++; console.log(`other change: ${key}`); }
}
console.log(`${same + shared + other} inputs: ${same} identical, ${shared} differ by the shared-visit pass alone, ${other} differ otherwise`);
