// TFP-207 (copied from TFP-188's, its bug patterns unchanged; Standard only, the ticket's scope): for each of the 37 scored bugs, the with-bugs failures, findings and manual-review items
// that could be its evidence, each marked "also on clean" when the clean copy has the same one (the
// same check and cause, as TFP-175's diff reads them). TFP-154's committed rule decides the verdict,
// by reading; this only gathers. Patterns are written from the answer key's descriptions, wide
// enough to show near misses too.
// Usage (from benchmarks/2026-10-15-tfp207-regression/runs/): node ../evidence.mjs [with-bugs prefix] [clean prefix]
import { readFileSync } from "node:fs";

const [wbPrefix = "with-bugs", clPrefix = "clean"] = process.argv.slice(2);
const norm = (s) => s
    .replace(/^TF[A-Z]+-\d+: /, "")
    .replace(/\/#\//g, "/").replace(/\/#(?=[^\w]|$)/g, "/")
    .replace(/\/product\/[0-9A-Z]+/g, "/product/:id")
    .replace(/product-[0-9A-Z]{10,}/g, "product-:id")
    .replace(/https:\/\/(with-bugs\.)?practicesoftwaretesting\.com/g, "<site>")
    .replace(/https:\/\/api(-with-bugs)?\.practicesoftwaretesting\.com/g, "<api>")
    .replace(/http:\/\/localhost:4200/g, "<site>")
    .replace(/http:\/\/localhost:8091/g, "<api>")
    .replace(/\[_ngcontent-ng-c\d+(="")?\]/g, "")
    .replace(/testforge-missing-[a-z0-9]+/g, "testforge-missing-<id>")
    .replace(/_ngcontent-ng-c\d+/g, "_ngcontent");
const items = (prefix) => ["standard"].flatMap((run) => {
    const file = JSON.parse(readFileSync(`${prefix}-${run}-records.json`, "utf8"));
    return file.records.flatMap((r) => [
        ...(r.status === "Failed" ? [{ kind: "failure", title: r.title, page: r.page, text: r.message.slice(0, 600) }] : []),
        ...r.findings.map((f) => ({ kind: "finding", title: r.title, page: r.page, text: f })),
        ...r.issues.filter((i) => i.startsWith("manual-review")).map((i) => ({ kind: "manual-review", title: r.title, page: r.page, text: i })),
    ]).map((x) => ({ ...x, run, key: run + " | " + x.kind + " | " + norm(x.title) + " | " + norm(x.text) }));
});
const wb = items(wbPrefix);
const clean = new Set(items(clPrefix).map((x) => x.key));

const BUGS = {
    2: /sorting by "Name \(A - Z\)"|sorting by "Price/,
    3: /chainsaws.*(not found|cannot exist)|chainsaws \(draws the same/,
    4: /card titles on .*category.*text-align|h5\.card-title differs across pages in text-align/,
    19: /fields of .* on \/#\/auth\/login .*padding/,
    22: /forgot-password.*(font-family|Comic)/,
    23: /fields of .* on \/#\/auth\/forgot-password .*padding/,
    26: /has its image hidden|images on \/#\/ that loaded but can't/,
    27: /slider on .* which does not carry|with the range on/,
    28: /broken\.png/,
    29: /"Home" on .* leads to/,
    30: /grid-title.*broken\.png|broken\.png, broken\.png/,
    31: /"Contakt"/,
    33: /"Sorth"|select-name|sort.*accessible name/i,
    34: /"Serch"/,
    40: /"\+" beside|quantity.*1 -> 1/,
    42: /"Reltded"/,
    45: /overlap by/,
    46: /text-reset|color-contrast.*badge/,
    49: /center on \/#\/rentals|card titles on \/#\/rentals/,
    53: /(positive tabindex|Tab) on \/#\/auth\/register/,
    54: /phone/i,
    58: /btnSubmit.*\/#\/auth\/register|\/#\/auth\/register.*btnSubmit/,
    59: /"Austria"|"Netherlands/,
    60: /offers "Error|Error 101/,
    62: /"Massage"|massage/,
    63: /"Attachment" has font-family/,
    66: /btnSubmit.*\/#\/contact/,
    67: /"Return" has font-size/,
    75: /returns "stock"/,
    80: /logs\/laravel\.log/,
    82: /sequential integer ids/,
    85: /color-contrast[^;]*a\[target="_blank"\]/,
    87: /auth\/login.*(placeholder|#email|#password)/,
    91: /quantity|input\[type="number"\]/,
    92: /image-alt.*product|product.*image-alt/,
    93: /form fields on \/#\/ with no accessible name|label \(critical\)[^;]*form-control/,
    94: /checkboxes sharing .* on \/#\/(?!category)/,
};
for (const [bug, pattern] of Object.entries(BUGS)) {
    const hits = wb.filter((x) => pattern.test(x.text) || pattern.test(x.title));
    console.log(`== ${bug}: ${hits.length} item(s)`);
    for (const x of hits.slice(0, 8)) {
        console.log(`   [${x.run} ${x.kind}${clean.has(x.key) ? ", ALSO ON CLEAN" : ""}] ${x.page ?? ""} | ${norm(x.title).slice(0, 70)} || ${x.text.replace(/\s+/g, " ").slice(0, 220)}`);
    }
    if (hits.length > 8) console.log(`   ... and ${hits.length - 8} more`);
}
