// Phase 41 (TFP-180): TFP-175's diff (benchmarks/2026-10-06-toolshop-known-bugs/diff-runs.mjs)
// on this run's records: each with-bugs failure, finding and manual-review
// item, and whether the clean site has the same one. As there, a page is
// read as /x for /#/x and probe randoms are masked. One change: the two
// sites' selections pick different products (by most interactive elements),
// so every product page is read as /product/:id.
// Usage (from benchmarks/2026-10-07-phase41-local/runs/): node ../diff-runs.mjs
import { readFileSync } from "node:fs";
const norm = (s) => s
    .replace(/^TF[A-Z]+-\d+: /, "")
    .replace(/\/#\//g, "/").replace(/\/#(?=[^\w]|$)/g, "/")
    .replace(/\/product\/[0-9A-Z]+/g, "/product/:id")
    .replace(/product-[0-9A-Z]{10,}/g, "product-:id")
    .replace(/https:\/\/(with-bugs\.)?practicesoftwaretesting\.com/g, "<site>")
    // Local copies: one address for both, and a development build's Angular attributes.
    .replace(/http:\/\/localhost:4200/g, "<site>")
    .replace(/\[_ngcontent-ng-c\d+(="")?\]/g, "")
    .replace(/testforge-missing-[a-z0-9]+/g, "testforge-missing-<id>")
    .replace(/_ngcontent-ng-c\d+/g, "_ngcontent")
    .replace(/Measured once.*$/, "");
const items = (file) => {
    const j = JSON.parse(readFileSync(file, "utf8"));
    return j.records.flatMap((r) => [
        ...(r.status === "Failed" ? [{ kind: "failure", title: r.title, text: r.message.slice(0, 300) }] : []),
        ...r.findings.map((f) => ({ kind: "finding", title: r.title, text: f })),
        ...r.issues.filter((i) => i.startsWith("manual-review")).map((i) => ({ kind: "manual-review", title: r.title, text: i })),
    ]).map((x) => ({ ...x, key: x.kind + " | " + norm(x.title) + " | " + norm(x.text) }));
};
for (const kind of ["standard", "security", "accessibility"]) {
    const wb = items(`with-bugs-${kind}-records.json`), cl = new Set(items(`clean-${kind}-records.json`).map((x) => x.key));
    const only = wb.filter((x) => !cl.has(x.key)), shared = wb.filter((x) => cl.has(x.key));
    console.log(`== ${kind}: with-bugs ${wb.length} items, ${shared.length} also on clean, ${only.length} only on with-bugs`);
    for (const x of only) console.log(`  [${x.kind}] ${norm(x.title).slice(0, 90)} || ${x.text.replace(/\s+/g, " ").slice(0, 260)}`);
}
