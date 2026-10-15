// TFP-205: the template baseline, updated only for the added link tests. check:template-unchanged compares the
// template's output on its 166 fixed inputs between two refs and keeps both sides
// (comparisons/template-unchanged/<base>-<head>/base.json and head.json, gitignored). This takes those two files
// and, for every input, removes from the head's output each test TFP-205 added (`link "...": on the page, named,
// with a valid href`), then requires what is left to equal the base's output byte for byte. It counts the added
// tests per input and writes the result to template-baseline.md.
// Usage (from the repo root, after `npm run check:template-unchanged -- <base>`):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-15-tfp205-link-tests/verify-template.mts <base>-<head>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { parseTestUnits } = await import(pathToFileURL(join(root, "src/lib/site-suites/units.ts")).href);
const folder = process.argv[2];
if (!folder) throw new Error("usage: <base>-<head> (the folder under comparisons/template-unchanged/)");
const dir = join(root, "comparisons", "template-unchanged", folder);
const base = JSON.parse(readFileSync(join(dir, "base.json"), "utf8")) as Record<string, string>;
const head = JSON.parse(readFileSync(join(dir, "head.json"), "utf8")) as Record<string, string>;
const ADDED = /^link ".*" on .+: on the page, named, with a valid href$/;

type Unit = { title: string; start: number; end: number };
// An input's key holds "|", which would split a markdown table cell.
const cell = (text: string) => text.replace(/\|/g, "\\|");
const rows: string[] = [];
let identical = 0;
let onlyAdded = 0;
let other = 0;
let added = 0;
for (const key of Object.keys(base)) {
    if (base[key] === head[key]) {
        identical++;
        continue;
    }
    const units = (parseTestUnits(head[key]) as Unit[]).filter((unit) => ADDED.test(unit.title)).sort((a, b) => b.start - a.start);
    // A removed test takes the blank line before it, as it was appended after the suite's previous test.
    let rest = head[key];
    for (const unit of units) {
        const from = rest.lastIndexOf("\n\n", unit.start) >= 0 && rest.slice(rest.lastIndexOf("\n\n", unit.start), unit.start).trim() === "" ? rest.lastIndexOf("\n\n", unit.start) : unit.start;
        rest = rest.slice(0, from) + rest.slice(unit.end);
    }
    if (rest === base[key]) {
        onlyAdded++;
        added += units.length;
        rows.push(`| ${cell(key)} | ${units.length} |`);
    } else {
        other++;
        const a = base[key].split("\n");
        const b = rest.split("\n");
        const line = a.findIndex((text, index) => text !== b[index]);
        rows.push(`| ${cell(key)} | **other change** at line ${line + 1}: base \`${(a[line] ?? "").trim().slice(0, 80)}\`, head \`${(b[line] ?? "").trim().slice(0, 80)}\` |`);
    }
}
const total = Object.keys(base).length;
const summary = `${total} inputs: ${identical} identical, ${onlyAdded} differing only by the added link tests (${added} tests in all), ${other} with any other change.`;
writeFileSync(join(root, "benchmarks/2026-10-15-tfp205-link-tests/template-baseline.md"), `# TFP-205: the template baseline, updated for the added link tests\n\n\`npm run check:template-unchanged -- ${folder.split("-")[0]}\` on the code with TFP-205, then \`verify-template.mts ${folder}\`: each added link test taken out of the new output, what is left compared byte for byte with the old.\n\n**${summary}**\n\n| Input | Added link tests |\n| --- | --- |\n${rows.join("\n")}\n`, "utf8");
console.log(summary);
process.exit(other === 0 ? 0 : 1);
