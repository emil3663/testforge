// TFP-175: failures whose check and cause did not appear in TFP-154's
// re-score runs (runs-tfp167), on each site, with the page taken out of
// both - so a failure the re-score had on another page isn't "new", and a
// failure that is new only because a new page was selected is listed once
// with the pages it was on. Each one listed must be a scored bug or
// labelled (Decision 9). Usage (from this folder's runs/): node ../new-failures.mjs
import { readFileSync } from "node:fs";
const page = /\/(#\/)?(product\/[0-9A-Z]+|category\/[a-z-]+|auth\/[a-z-]+|contact|rentals|chainsaws|privacy)?(?=[\s:,'")]|$)/g;
const norm = (s) => s
    .replace(/^TF[A-Z]+-\d+: /, "")
    .replace(/https:\/\/(with-bugs\.)?practicesoftwaretesting\.com/g, "<site>")
    .replace(/testforge-missing-[a-z0-9]+/g, "testforge-missing-<id>")
    .replace(/_ngcontent-ng-c\d+(="")?/g, "_ngcontent")
    .replace(/product-[0-9A-Z]+/g, "product-:id")
    .replace(/#\/product\/\d+/g, "#/product/:id")
    .replace(/Measured once.*$/, "")
    .replace(page, "<page>")
    .replace(/\s+/g, " ").slice(0, 220);
const failures = (file) => {
    const j = JSON.parse(readFileSync(file, "utf8"));
    return j.records.filter((r) => r.status === "Failed").map((r) => ({ page: r.page ?? "", key: norm(r.title) + " || " + norm(r.message) }));
};
for (const site of ["with-bugs", "clean"]) {
    for (const kind of ["standard", "security", "accessibility"]) {
        const now = failures(`${site}-${kind}-records.json`);
        const before = new Set(failures(`../../2026-10-06-toolshop-known-bugs/runs-tfp167/${site}-${kind}-records.json`).map((f) => f.key));
        const fresh = new Map();
        for (const f of now.filter((f) => !before.has(f.key))) fresh.set(f.key, [...(fresh.get(f.key) ?? []), f.page]);
        console.log(`== ${site} ${kind}: ${now.length} failures, ${now.length - [...fresh.values()].flat().length} as in the re-score, ${fresh.size} new kinds`);
        for (const [key, pages] of fresh) console.log(`  [${pages.length}] ${[...new Set(pages)].join(" ")}\n      ${key}`);
    }
}
