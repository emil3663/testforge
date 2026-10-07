// TFP-178: every clean-Toolshop failure in TFP-154's re-score (runs-tfp167) and
// TFP-175 (runs), each given its label from docs/decisions/data/labelled-failures.md
// by the rule below, read by hand first. Prints the count per label and run,
// and fails if any failure is left without a label.
// Usage (from benchmarks/): node 2026-10-07-tfp175-selection/label-clean.mjs
import { readFileSync } from "node:fs";
const runs = [["re-score", "2026-10-06-toolshop-known-bugs/runs-tfp167"], ["TFP-175", "2026-10-07-tfp175-selection/runs"]];
// [label, test title, message]: the first rule that matches both names the failure's label.
const RULES = [
    ["R13", /keeps (meta description|canonical metadata) stable|publishes (robots\.txt|sitemap\.xml)/, /./],
    ["R16", /passes the WCAG 2\.2 A and AA scan/, /^Error: serious or critical WCAG violations on [^:]+: WCAG 1\.3\.1 list/],
    ["R10+R16", /passes the WCAG 2\.2 A and AA scan/, /button-name \(critical\)[^;]*btn-outline-secondary; WCAG 1\.3\.1 list/],
    ["R10", /passes the WCAG 2\.2 A and AA scan/, /button-name \(critical\)[^;]*btn-outline-secondary/],
    ["R17", /passes the WCAG 2\.2 A and AA scan/, /target-size/],
    ["T28", /puts no password or session token in a URL/, /would send its password field in the URL/],
    ["R11", /storage failure injection: localStorage/, /storage entry point mocked to fail/],
    ["U2", /visited style configuration/, /./],
    ["U3", /links are distinguishable from surrounding text/, /./],
    ["T31", /link types: .* classified correctly/, /name: '(Combination Pliers ABCDE\$14\.15|Learn Test AutomationHands-on)/],
    ["U5", /link types: .* classified correctly/, /name: 'Hammer More information'/],
    ["U6", /link health: internal, external, and download links/, /Broken link detected for GitHub/],
    ["U7", /orphan page approximation/, /\/product\/01M48AGCWN26TFYQ1FQ6S7FNJF is not linked/],
];
const counts = {};
const unlabelled = [];
for (const [run, dir] of runs) {
    for (const kind of ["standard", "security", "accessibility"]) {
        const records = JSON.parse(readFileSync(`${dir}/clean-${kind}-records.json`, "utf8")).records.filter((record) => record.status === "Failed");
        for (const record of records) {
            const rule = RULES.find(([, title, message]) => title.test(record.title) && message.test(record.message));
            if (!rule) {
                unlabelled.push(`${run} ${kind}: ${record.title} || ${record.message.slice(0, 160)}`);
                continue;
            }
            counts[rule[0]] ??= {};
            counts[rule[0]][`${run} ${kind}`] = (counts[rule[0]][`${run} ${kind}`] ?? 0) + 1;
        }
    }
}
const columns = runs.flatMap(([run]) => ["standard", "security", "accessibility"].map((kind) => `${run} ${kind}`));
console.log(`| Label | ${columns.join(" | ")} | Total |`);
console.log(`| --- | ${columns.map(() => "---").join(" | ")} | --- |`);
for (const [label, byRun] of Object.entries(counts)) console.log(`| ${label} | ${columns.map((column) => byRun[column] ?? 0).join(" | ")} | ${Object.values(byRun).reduce((a, b) => a + b, 0)} |`);
const totals = columns.map((column) => Object.values(counts).reduce((sum, byRun) => sum + (byRun[column] ?? 0), 0));
console.log(`| **all** | ${totals.join(" | ")} | ${totals.reduce((a, b) => a + b, 0)} |`);
if (unlabelled.length > 0) {
    console.error(`${unlabelled.length} failures without a label:\n${unlabelled.join("\n")}`);
    process.exit(1);
}
