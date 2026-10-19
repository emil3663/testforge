// TFP-208: for each copy, against R1 (TFP-207) on the same copy: the run's tests and time; TFP-205's link tests and
// TFP-208's card tests (how many, how many failed, their time from the Playwright report); the coverage map's
// in-context gap list; and the failures, as a multiset by title, that are new and that are gone. Reads runs/; no
// browser, no network.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-16-tfp208/analyse.mts > benchmarks/2026-10-16-tfp208/analysis.txt
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (p: string) => import(pathToFileURL(join(root, p)).href);
const { buildCoverageMap, untouched } = await load("src/lib/report/coverage-map.ts");
const { normalizeContentProfile } = await load("src/lib/generate/normalize.ts");
const R = "benchmarks/2026-10-16-tfp208/runs";
const R1 = "benchmarks/2026-10-15-tfp207-regression/runs";
type Rec = { title: string; page: string | null; status: string; message: string };
type Run = { tests: number; byStatus: Record<string, number>; runSeconds: number; commit: string; records: Rec[] };
type Suite = { specs?: { title: string; tests: { results: { duration: number }[] }[] }[]; suites?: Suite[] };
const norm = (t: string) => t.replace(/^TF[A-Z]+-\d+: /, "").replace(/\/product\/[0-9A-Z]{26}/g, "/product/:id");
const isLink = (t: string) => /^link ".*" on .+: on the page, named, with a valid href$/.test(norm(t));
const isCards = (t: string) => /^cards linking to .+ on .+: each on the page/.test(norm(t));
const failed = (rs: Rec[]) => rs.filter((r) => r.status === "Failed" || r.status === "Blocked");

/** Each test's duration in seconds, by normalised title, from a Playwright JSON report. */
function durations(file: string) {
    const out = new Map<string, number>();
    const walk = (suites: Suite[]) => suites.forEach((suite) => {
        (suite.specs ?? []).forEach((spec) => out.set(norm(spec.title), spec.tests.flatMap((t) => t.results).reduce((sum, r) => sum + r.duration, 0) / 1000));
        walk(suite.suites ?? []);
    });
    walk((JSON.parse(readFileSync(file, "utf8")) as { suites: Suite[] }).suites);
    return out;
}

/** a minus b, as multisets of normalised titles. */
function minus(a: Rec[], b: Rec[]) {
    const left = new Map<string, number>();
    for (const r of b) left.set(norm(r.title), (left.get(norm(r.title)) ?? 0) + 1);
    return a.filter((r) => {
        const n = left.get(norm(r.title)) ?? 0;
        if (n > 0) { left.set(norm(r.title), n - 1); return false; }
        return true;
    });
}

for (const copy of ["with-bugs", "clean"]) {
    if (!existsSync(join(R, `${copy}-standard-records.json`))) continue;
    const ours = JSON.parse(readFileSync(join(R, `${copy}-standard-records.json`), "utf8")) as Run;
    const r1 = JSON.parse(readFileSync(join(R1, `${copy}-standard-records.json`), "utf8")) as Run;
    const time = durations(join(R, `${copy}-standard-report.json`));
    const time1 = durations(join(R1, `${copy}-standard-report.json`));
    const seconds = (rs: Rec[], t: Map<string, number>) => Math.round(rs.reduce((sum, r) => sum + (t.get(norm(r.title)) ?? 0), 0));
    console.log(`== ${copy}: ${ours.tests} tests ${JSON.stringify(ours.byStatus)}, run ${ours.runSeconds} s, commit ${ours.commit}; R1 ${r1.tests} tests ${JSON.stringify(r1.byStatus)}, run ${r1.runSeconds} s`);
    const links = ours.records.filter((r) => isLink(r.title));
    const cards = ours.records.filter((r) => isCards(r.title));
    const links1 = r1.records.filter((r) => isLink(r.title));
    console.log(`link tests: ${links.length} ran, ${failed(links).length} failed, ${seconds(links, time)} s (R1: ${links1.length}, ${failed(links1).length} failed, ${seconds(links1, time1)} s)`);
    console.log(`card tests: ${cards.length} ran, ${failed(cards).length} failed, ${seconds(cards, time)} s`);
    for (const r of cards) console.log(`  card test | ${r.status} | ${norm(r.title)}${r.message ? " | " + r.message.slice(0, 260) : ""}`);
    for (const r of failed(links)) console.log(`  link failed | ${r.page} | ${norm(r.title)} | ${r.message.slice(0, 260)}`);
    const profile = normalizeContentProfile(JSON.parse(readFileSync(join(R, `${copy}-standard-profile.json`), "utf8")));
    const suite = readFileSync(join(R, `${copy}-standard-suite.spec.ts`), "utf8");
    const map = buildCoverageMap(profile, suite);
    const gaps = untouched(map).filter((e: { kind: string }) => e.kind !== "flow");
    console.log(`coverage map: ${map.covered} of ${map.total} in context, ${map.reachedOnly} reached only; in-context gaps: ${gaps.filter((e: { kind: string }) => e.kind === "element").length} elements, ${gaps.filter((e: { kind: string }) => e.kind === "link").length} links${gaps.some((e: { kind: string }) => e.kind === "link") ? " - " + gaps.filter((e: { kind: string }) => e.kind === "link").map((e: { page: string; name: string }) => `${e.page}: ${e.name}`).join("; ") : ""}`);
    const fresh = minus(failed(ours.records), failed(r1.records));
    const gone = minus(failed(r1.records), failed(ours.records));
    console.log(`failures: ${failed(ours.records).length} (R1 ${failed(r1.records).length}); new against R1: ${fresh.length}; R1's, not failing now: ${gone.length}`);
    for (const r of fresh) console.log(`  + ${r.page} | ${norm(r.title)} | ${r.message.slice(0, 260)}`);
    for (const r of gone) console.log(`  - ${r.page} | ${norm(r.title)} | ${r.message.slice(0, 200)}`);
    console.log("");
}
