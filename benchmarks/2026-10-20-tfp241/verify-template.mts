// TFP-241: the template's output changes only in the shared-visit helper's text, and in one line added to each page's
// group (the afterAll that ends its visit). For check:template-unchanged's 166 fixed inputs: the base's output, with
// the base's helper (at <base>) replaced by this commit's and that line added to each group, is the head's output, byte
// for byte.
// Usage (from the repo root, after `npm run check:template-unchanged -- <base> <head>`):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-tfp241/verify-template.mts <base> <comparisonDir>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { SHARED_VISIT_HELPER } = await import(pathToFileURL(join(process.cwd(), "src/lib/generate/shared-visits.ts")).href);
const [baseRef, dir] = process.argv.slice(2);
const baseSource = execFileSync("git", ["show", `${baseRef}:src/lib/generate/shared-visits.ts`], { encoding: "utf8" });
const baseHelper = new Function("return `" + /export const SHARED_VISIT_HELPER = `([\s\S]*?)`;\n/.exec(baseSource)![1] + "`;")() as string;
const NL = String.fromCharCode(10);
const GROUP_START = "  const expect = tfSharedExpect;" + NL;
const GROUP_LINE = "  // TFP-241: the visit ends with its group, so a visit no check failed on keeps no video." + NL + "  test.afterAll(async () => { await tfEndSharedVisit(tfSharedVisit); tfSharedVisit = null; });" + NL;
const withGroupLine = (code: string) => code.split(GROUP_START).join(GROUP_START + GROUP_LINE);
const base = JSON.parse(readFileSync(join(dir, "base.json"), "utf8")) as Record<string, string>;
const head = JSON.parse(readFileSync(join(dir, "head.json"), "utf8")) as Record<string, string>;
let same = 0, changed = 0, other = 0;
for (const [key, code] of Object.entries(base)) {
    if (code === head[key]) same++;
    else if (code.includes(baseHelper) && withGroupLine(code.replace(baseHelper, SHARED_VISIT_HELPER)) === head[key]) changed++;
    else { other++; console.log(`other change: ${key}`); }
}
console.log(`${same + changed + other} inputs: ${same} identical, ${changed} differ by the helper's text and the groups' afterAll line alone, ${other} differ otherwise`);
