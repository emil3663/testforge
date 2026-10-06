// TFP-154: each with-bugs failure, finding and manual-review item, and whether
// the clean site has the same one (page read as /x for /#/x, product id
// mapped, check IDs and probe randoms masked).
import { readFileSync } from "node:fs";
const norm = (s) => s
    .replace(/^TF[A-Z]+-\d+: /, "")
    .replace(/\/#\//g, "/").replace(/\/#(?=[^\w]|$)/g, "/")
    .replace(/\/product\/01M48AGCWN26TFYQ1FQ6S7FNJF/g, "/product/1")
    .replace(/https:\/\/(with-bugs\.)?practicesoftwaretesting\.com/g, "<site>")
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
    for (const x of only) console.log(`  [${x.kind}] ${norm(x.title).slice(0, 80)} || ${x.text.replace(/\s+/g, " ").slice(0, 230)}`);
}
