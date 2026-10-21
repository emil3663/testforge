// TFP-155, Decision 12: splitting a suite into units changes no test. For each of check:template-unchanged's 166 fixed
// inputs (its head.json), every test of the suite is in exactly one unit, with the same id, title, describes and body,
// and each unit starts with the suite's top level. Also: how the inputs split.
// Usage (from the repo root, after `npm run check:template-unchanged -- <base> [<head>]`):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-tfp155/verify-split.mts <comparisonDir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const load = (path: string) => import(pathToFileURL(join(process.cwd(), path)).href);
const { splitSuite } = await load("src/lib/run/split.ts");
const { parseTestUnits } = await load("src/lib/site-suites/units.ts");
const head = JSON.parse(readFileSync(join(process.argv[2], "head.json"), "utf8")) as Record<string, string>;
const testsOf = (codes: string[]) => codes.flatMap((code) => parseTestUnits(code)).map((unit: { id: string; title: string; describe: string[]; source: string }) => JSON.stringify([unit.id, unit.title, unit.describe, unit.source])).sort();
let same = 0, other = 0, single = 0, tests = 0;
const files: number[] = [];
for (const [key, code] of Object.entries(head)) {
    const units = splitSuite(code) as Array<{ code: string }>;
    files.push(units.length);
    if (units.length === 1) single++;
    const before = testsOf([code]);
    tests += before.length;
    if (JSON.stringify(testsOf(units.map((unit) => unit.code))) === JSON.stringify(before)) same++;
    else { other++; console.log(`tests differ: ${key}`); }
}
files.sort((a, b) => a - b);
console.log(`${same + other} inputs, ${tests} tests: ${same} split with every test unchanged, ${other} otherwise; ${single} left as one file; unit files per input: ${files[0]} to ${files.at(-1)}, median ${files[Math.floor(files.length / 2)]}`);
