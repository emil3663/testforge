// TFP-207: for each copy, TFP-205's link tests (how many ran, how many failed, and why), the coverage map's
// in-context gap list, and the failures against Phase 41's Gate B (TFP-188's Standard run on the same copy):
// which are new and which are gone. Reads runs/; no browser, no network.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-15-tfp207-regression/analyse.mts > benchmarks/2026-10-15-tfp207-regression/analysis.txt
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (p: string) => import(pathToFileURL(join(root, p)).href);
const { buildCoverageMap, untouched } = await load("src/lib/report/coverage-map.ts");
const { normalizeContentProfile } = await load("src/lib/generate/normalize.ts");
const R = "benchmarks/2026-10-15-tfp207-regression/runs";
const G = "benchmarks/2026-10-13-tfp188/runs";
type Rec = { title: string; page: string | null; status: string; message: string };
const norm = (t: string) => t.replace(/^TF[A-Z]+-\d+: /, "").replace(/\/product\/[0-9A-Z]{26}/g, "/product/:id");
const isLink = (t: string) => /^link ".*" on .+: on the page, named, with a valid href$/.test(norm(t));
for (const copy of ["with-bugs", "clean"]) {
    if (!existsSync(join(R, `${copy}-standard-records.json`))) continue;
    const ours = JSON.parse(readFileSync(join(R, `${copy}-standard-records.json`), "utf8")) as { tests: number; byStatus: Record<string, number>; runSeconds: number; commit: string; records: Rec[] };
    const theirs = JSON.parse(readFileSync(join(G, `${copy}-standard-records.json`), "utf8")) as { tests: number; byStatus: Record<string, number>; records: Rec[] };
    console.log(`== ${copy}: ${ours.tests} tests ${JSON.stringify(ours.byStatus)}, run ${ours.runSeconds} s, commit ${ours.commit}; Gate B ${theirs.tests} tests ${JSON.stringify(theirs.byStatus)}`);
    const links = ours.records.filter((r) => isLink(r.title));
    const linkFailed = links.filter((r) => r.status === "Failed" || r.status === "Blocked");
    console.log(`TFP-205 link tests: ${links.length} ran, ${linkFailed.length} failed, ${links.filter((r) => r.status === "Not run").length} not run`);
    for (const r of linkFailed) console.log(`  link failed | ${r.page} | ${norm(r.title)} | ${r.message.slice(0, 260)}`);
    const profile = normalizeContentProfile(JSON.parse(readFileSync(join(R, `${copy}-standard-profile.json`), "utf8")));
    const suite = readFileSync(join(R, `${copy}-standard-suite.spec.ts`), "utf8");
    const map = buildCoverageMap(profile, suite);
    const gaps = untouched(map).filter((e: { kind: string }) => e.kind !== "flow");
    console.log(`coverage map: ${map.covered} of ${map.total} in context, ${map.reachedOnly} reached only; in-context gaps (elements and links): ${gaps.length}${gaps.length ? " - " + gaps.map((e: { kind: string; page: string; name: string }) => `${e.kind} ${e.page}: ${e.name}`).join("; ") : ""}; links on the gap list: ${gaps.filter((e: { kind: string }) => e.kind === "link").length}`);
    const failed = (rs: Rec[]) => rs.filter((r) => r.status === "Failed" || r.status === "Blocked");
    const before = new Set(failed(theirs.records).map((r) => norm(r.title)));
    const now = new Set(failed(ours.records).map((r) => norm(r.title)));
    const fresh = failed(ours.records).filter((r) => !before.has(norm(r.title)));
    const gone = failed(theirs.records).filter((r) => !now.has(norm(r.title)));
    console.log(`failures: ${failed(ours.records).length} (Gate B ${failed(theirs.records).length}); not in Gate B: ${fresh.length}; in Gate B, passing now: ${gone.length}`);
    for (const r of fresh) console.log(`  + ${r.page} | ${norm(r.title)} | ${r.message.slice(0, 260)}`);
    for (const r of gone) console.log(`  - ${r.page} | ${norm(r.title)} | ${r.message.slice(0, 200)}`);
    console.log("");
}
