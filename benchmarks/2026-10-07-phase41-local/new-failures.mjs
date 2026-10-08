// Phase 41 (TFP-180): failures on a local copy whose check and cause the same version's hosted run
// in TFP-175 didn't have, the page and the site's address taken out (TFP-175's new-failures.mjs,
// compared against benchmarks/2026-10-07-tfp175-selection/runs instead of the re-score). Each
// kind listed must be a scored bug or labelled. Usage (from this folder's runs/): node ../new-failures.mjs
import { readFileSync } from "node:fs";
const page = /\/(#\/)?(product\/[0-9A-Z]+|category\/[a-z-]+|auth\/[a-z-]+|contact|rentals|chainsaws|privacy)?(?=[\s:,'")]|$)/g;
const norm = (s) => s
    .replace(/^TF[A-Z]+-\d+: /, "")
    .replace(/https:\/\/(with-bugs\.)?practicesoftwaretesting\.com|http:\/\/localhost:4200/g, "<site>")
    .replace(/testforge-missing-[a-z0-9]+/g, "testforge-missing-<id>")
    .replace(/\[?_ngcontent-ng-c\d+(="")?\]?/g, "")
    .replace(/product-[0-9A-Z]+/g, "product-:id")
    .replace(/#\/product\/\d+/g, "#/product/:id")
    .replace(/Measured once.*$/, "")
    .replace(page, "<page>")
    .replace(/\s+/g, " ").slice(0, 200);
const failures = (file) => JSON.parse(readFileSync(file, "utf8")).records.filter((r) => r.status === "Failed").map((r) => ({ key: norm(r.title) + " || " + norm(r.message) }));
for (const site of ["with-bugs", "clean"]) {
    for (const kind of ["standard", "security", "accessibility"]) {
        const now = failures(`${site}-${kind}-records.json`);
        const before = new Set(failures(`../../2026-10-07-tfp175-selection/runs/${site}-${kind}-records.json`).map((f) => f.key));
        const fresh = new Map();
        for (const f of now.filter((f) => !before.has(f.key))) fresh.set(f.key, (fresh.get(f.key) ?? 0) + 1);
        console.log(`== ${site} ${kind}: ${now.length} failures, ${now.length - [...fresh.values()].reduce((a, b) => a + b, 0)} as in TFP-175's hosted run, ${fresh.size} new kinds`);
        for (const [key, n] of fresh) console.log(`  [${n}] ${key}`);
    }
}
