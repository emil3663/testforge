// Phase 39 Gate C: the session's numbers against the record's Gate C table (phase-39-run-concurrency-decision-record.md).
//   C against C1   TFP-241's cost, with-bugs Standard                under 5%, or the video is dropped
//   C1 against C2  TFP-214, Standard on each copy                    at least 10% faster
//   A against C2   accessibility on each copy                        at least 30% faster
//   C2 against F   TFP-222, TFP-155, TFP-156 (Standard, accessibility) the same results; no slower beyond the 5% spread
//   F against FL   where the axe scan runs (accessibility, each copy) identical axe findings and faster, or the built order stays
// Every comparison also gets Decision 7's proof (Gate B's method: failures and findings, test by test, a test that
// varies between runs of one variant listed apart), and the with-bugs / sort check's message is compared again.
// Medians of three runs. Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-gate-c/analyse.mts [<runsDir>] > benchmarks/2026-10-21-gate-c/analysis.md
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const R = process.argv[2] ?? "benchmarks/2026-10-21-gate-c/runs";
type Rec = { title: string; page: string | null; status: string; message: string; findings: string[]; issues?: string[] };
type Run = { runSeconds: number; tests: number; units?: number; passes?: number; serialTests?: number; byStatus: Record<string, number>; records: Rec[] };
const LABELS = ["with-bugs", "clean", "fixture"];
const read = (variant: string, label: string, kind: string, run: number): Run | null => {
    const file = join(R, variant, `${label}-${kind}-run${run}-records.json`);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Run) : null;
};
const runs = (variant: string, label: string, kind: string) => [1, 2, 3].map((run) => read(variant, label, kind, run)).filter((run): run is Run => run !== null);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const medianOf = (list: Run[]) => (list.length ? median(list.map((run) => run.runSeconds)) : null);
const cell = (list: Run[]) => (list.length ? `${medianOf(list)} (${list.map((run) => run.runSeconds).join(", ")})` : "-");
const norm = (text: string) => text.replace(/^TF[A-Z]+-\d+: /, "").replace(/01M[0-9A-Z]{23}/g, "<id>");
const key = (record: Rec) => `${norm(record.title)} @${norm(record.page ?? "")}`;
function multiset(records: Rec[], pick: (record: Rec) => string[]) {
    const counts = new Map<string, number>();
    for (const record of records) for (const item of pick(record)) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
}
const failures = (run: Run) => multiset(run.records, (record) => (record.status === "Failed" ? [key(record)] : []));
const findings = (run: Run) => multiset(run.records, (record) => record.findings.map((finding) => `${key(record)} | ${norm(finding)}`));
function difference(left: Map<string, number>, right: Map<string, number>) {
    const out: string[] = [];
    for (const [item, count] of left) if (count > (right.get(item) ?? 0)) out.push(item + (count - (right.get(item) ?? 0) > 1 ? ` (x${count - (right.get(item) ?? 0)})` : ""));
    return out;
}

/** Decision 7 between two variants' runs: Gate B's method. Returns its lines and whether the stable tests agree. */
function sameResults(left: string, right: string, label: string, kind: string): { lines: string[]; same: boolean } {
    const a = runs(left, label, kind), b = runs(right, label, kind);
    if (!a.length || !b.length) return { lines: [], same: false };
    const stable = (list: Run[]) => list.every((run) => difference(failures(run), failures(list[0])).length === 0 && difference(failures(list[0]), failures(run)).length === 0);
    const testOf = (item: string) => item.split(" | ")[0].replace(/ \(x\d+\)$/, "");
    const varying = new Set<string>();
    for (const list of [a, b]) for (const run of list.slice(1)) for (const pick of [failures, findings]) {
        for (const item of [...difference(pick(run), pick(list[0])), ...difference(pick(list[0]), pick(run))]) varying.add(testOf(item));
    }
    const steady = (items: string[]) => items.filter((item) => !varying.has(testOf(item)));
    const onlyA = steady(difference(failures(a[0]), failures(b[0]))), onlyB = steady(difference(failures(b[0]), failures(a[0])));
    const fOnlyA = steady(difference(findings(a[0]), findings(b[0]))), fOnlyB = steady(difference(findings(b[0]), findings(a[0])));
    const total = (run: Run) => [...failures(run).values()].reduce((sum, count) => sum + count, 0);
    const same = onlyA.length + onlyB.length + fOnlyA.length + fOnlyB.length === 0;
    return {
        same,
        lines: [
            `- Failures: ${left} ${a.map(total).join("/")}, ${right} ${b.map(total).join("/")}; the same in every run: ${left} ${stable(a) ? "yes" : "no"}, ${right} ${stable(b) ? "yes" : "no"}.`,
            `- Run 1, tests that give the same in every run of each: ${onlyA.length} failing in ${left} only, ${onlyB.length} in ${right} only; findings ${fOnlyA.length} in ${left} only, ${fOnlyB.length} in ${right} only.`,
            `- Tests that vary between runs of one variant: ${varying.size}${varying.size ? ` (${[...varying].map((test) => test.slice(0, 90)).join("; ")})` : ""}.`,
            ...onlyA.map((item) => `  - failing in ${left} only: ${item}`), ...onlyB.map((item) => `  - failing in ${right} only: ${item}`),
            ...fOnlyA.slice(0, 10).map((item) => `  - finding in ${left} only: ${item}`), ...fOnlyB.slice(0, 10).map((item) => `  - finding in ${right} only: ${item}`),
        ],
    };
}

const out: string[] = ["# Phase 39 Gate C: the numbers", "", "Medians of three runs; each run's time in seconds, in run order.", ""];
const labels = LABELS.filter((label) => ["A", "C", "C1", "C2", "F", "FL"].some((variant) => runs(variant, label, "standard").length || runs(variant, label, "accessibility").length));
out.push("## Run times", "", "| Copy | Suite | A | C | C1 | C2 | F | FL |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const label of labels) for (const kind of ["standard", "accessibility"]) {
    out.push(`| ${label} | ${kind} | ${["A", "C", "C1", "C2", "F", "FL"].map((variant) => cell(runs(variant, label, kind))).join(" | ")} |`);
}
const f = runs("F", labels[0] ?? "with-bugs", "standard")[0];
if (f) out.push("", `F's Standard runs as ${f.units} unit file(s) in ${f.passes} pass(es), ${f.serialTests} test(s) in the serial group (${labels[0]}, run 1).`);

const verdicts: string[] = [];
const faster = (from: string, to: string, label: string, kind: string) => {
    const a = medianOf(runs(from, label, kind)), b = medianOf(runs(to, label, kind));
    return a !== null && b !== null ? { a, b, change: 1 - b / a } : null;
};
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const sections: string[] = [];
const comparison = (title: string, left: string, right: string, label: string, kind: string, verdict: (result: { a: number; b: number; change: number }, same: boolean) => string) => {
    const timing = faster(left, right, label, kind);
    const results = sameResults(left, right, label, kind);
    if (!timing) return;
    const line = verdict(timing, results.same);
    verdicts.push(`- ${title}, ${label} ${kind}: ${left} ${timing.a} s, ${right} ${timing.b} s. ${line}`);
    sections.push(`### ${title}: ${left} against ${right}, ${label} ${kind}`, "", ...results.lines, "");
};
for (const label of labels) {
    comparison("TFP-241's cost", "C", "C1", label, "standard", ({ change }) => `C1 ${pct(-change)} slower against a bar of under 5%: **${-change < 0.05 ? "kept" : "the video is dropped"}**.`);
}
for (const label of labels) {
    comparison("TFP-214", "C1", "C2", label, "standard", ({ change }) => `${pct(change)} faster against at least 10%: **${change >= 0.1 ? "met" : "not met"}**.`);
    comparison("Accessibility (moved from Gate B)", "A", "C2", label, "accessibility", ({ change }) => `${pct(change)} faster against at least 30%: **${change >= 0.3 ? "met" : "not met"}**.`);
    for (const kind of ["standard", "accessibility"]) {
        comparison("TFP-222, TFP-155, TFP-156", "C2", "F", label, kind, ({ change }, same) => `F ${change >= 0 ? `${pct(change)} faster` : `${pct(-change)} slower`} (no slower beyond 5%: **${-change <= 0.05 ? "met" : "not met"}**); the same results: **${same ? "yes" : "no, see below"}**.`);
    }
}
// Where the axe scan runs: the scans' own records, F against FL, every run.
for (const label of labels) {
    const fRuns = runs("F", label, "accessibility"), lRuns = runs("FL", label, "accessibility");
    const timing = faster("F", "FL", label, "accessibility");
    if (!timing) continue;
    const scans = (run: Run) => run.records.filter((record) => /passes the WCAG 2\.2 A and AA scan/.test(record.title)).map((record) => JSON.stringify([key(record), record.status, [...record.findings].map(norm).sort(), [...(record.issues ?? [])].map(norm).sort()])).sort();
    const identical = fRuns.every((run, index) => lRuns[index] && JSON.stringify(scans(run)) === JSON.stringify(scans(lRuns[index])));
    const differing = fRuns[0] && lRuns[0] ? scans(fRuns[0]).filter((item) => !scans(lRuns[0]).includes(item)).length : 0;
    verdicts.push(`- The axe order, ${label} accessibility: F (built order) ${timing.a} s, FL (scan last) ${timing.b} s, ${pct(timing.change)} ${timing.change >= 0 ? "faster" : "slower"}; the scans' findings identical in every run: ${identical ? "yes" : `no (run 1: ${differing} scan record(s) of F differ)`}. **${identical && timing.change > 0 ? "Scan last becomes the default" : "The built order stays"}**.`);
}
// The with-bugs / sort check's message (Gate B ruling 4), every variant, every run.
for (const label of labels.filter((entry) => entry !== "clean")) {
    const lines: string[] = [];
    for (const variant of ["C", "C1", "C2", "F"]) {
        for (const [index, run] of runs(variant, label, "standard").entries()) {
            const sort = run.records.find((record) => /sort options order the items on \/$/.test(record.title));
            if (sort) lines.push(`- ${variant} run ${index + 1}: ${sort.status}${sort.message ? `: ${sort.message.slice(0, 300)}` : ""}`);
        }
    }
    if (lines.length) sections.push(`### The ${label} / sort check's message, every run`, "", ...lines, "");
}
out.push("", "## Against the targets", "", ...verdicts, "", "## Decision 7: the same results, and the / sort message", "", ...sections);
console.log(out.join("\n"));
