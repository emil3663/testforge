// TFP-188 (Decision 6's keep rule): for each of Phase 41's checks, every failure and finding it
// recorded on each copy, so the rule can be applied check by check - does it find the present
// targets it was built for (with-bugs), and does it add anything on the clean copy that isn't
// labelled? Also counts TFP-181's guard breaches, which no run should have.
// Usage (from benchmarks/2026-10-13-tfp188/runs/): node ../keep.mjs
import { readFileSync } from "node:fs";

const CHECKS = [
    ["TFP-182 sort", /sort options order the items/],
    ["TFP-182 filter", /filters send and respect the chosen values/],
    ["TFP-182 stepper", /quantity steppers change the value by one/],
    ["TFP-182 option lists", /option lists show no error text/],
    ["TFP-182 link destination", /navigation links land where their text says/],
    ["TFP-183 tab order", /is tabbed through in reading order/],
    ["TFP-183 grouping", /groups its checkboxes and radio buttons/],
    ["TFP-184 known paths", /known paths that leak/],
    ["TFP-184 guessable ids", /guessable sequential ids/],
    ["TFP-185 API fields", /fetches no internal fields/],
    ["TFP-186 consistency", /keeps its forms, lists and cards consistent/],
    ["TFP-186 overlap", /has no overlapping controls/],
    ["TFP-186 images", /shows every image it loads/],
    ["TFP-186 across pages", /the same components look the same/],
    ["TFP-187 spelling", /spells its interface text correctly/],
];
const records = (copy) => ["standard", "security", "accessibility"].flatMap((run) => JSON.parse(readFileSync(`${copy}-${run}-records.json`, "utf8")).records.map((r) => ({ ...r, run })));
const copies = { "with-bugs": records("with-bugs"), clean: records("clean") };
const short = (text) => text.replace(/\s+/g, " ").replace(/ expect\(received\).*$/, "").replace(/^Error: /, "").slice(0, 260);

for (const [name, pattern] of CHECKS) {
    console.log(`== ${name}`);
    for (const [copy, list] of Object.entries(copies)) {
        const mine = list.filter((r) => pattern.test(r.title));
        const counts = {};
        for (const r of mine) counts[r.status] = (counts[r.status] ?? 0) + 1;
        console.log(`  ${copy}: ${mine.length} tests ${JSON.stringify(counts)}`);
        for (const r of mine) {
            if (r.status === "Failed") console.log(`    FAIL [${r.run}] ${r.page ?? ""}: ${short(r.message)}`);
            for (const f of r.findings) console.log(`    find [${r.run}] ${r.page ?? ""}: ${short(f)}`);
        }
    }
}
for (const [copy, list] of Object.entries(copies)) {
    const breaches = list.filter((r) => /read-only guard breach/.test(r.message));
    console.log(`guard breaches on ${copy}: ${breaches.length}${breaches.map((r) => `\n  ${r.title}: ${short(r.message)}`).join("")}`);
}
