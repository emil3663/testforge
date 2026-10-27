// Phase 39 Gate D's re-measurement (Gate D ruling 4, 2026-10-26): the session's numbers against the record's rules
// (phase-39-run-concurrency-decision-record.md), as Gate D's analyse.mts read them, beside Gate D's own numbers.
//   Decision 13   Comprehensive, every area (security and accessibility), on the local Toolshop: WN at least 40%
//                 faster than W1, medians of three (Gate A target 4); with Decision 12: on the fixture, every test the
//                 same result with 1 and N workers.
//   Decision 12   the same results W1 against WN (and W3), on the fixture and both local copies (Acceptance Criteria 7),
//                 Gate B's method (failures and findings, test by test; a test that varies between runs of one variant
//                 listed apart).
//   Ruling 4      W3, a lower local-host limit, when clean still overloads or differs with WN: recorded beside WN.
//   Ruling 5      the capped run on practicesoftwaretesting.com, with TFP-157's leak fix: its time and requests per
//                 second, the number the capped run's time budget is decided on; with its timeouts and timed checks
//                 Not run.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-27-gate-d-rerun/analyse.mts [<runsDir>] [<gateDRunsDir>] > benchmarks/2026-10-27-gate-d-rerun/analysis.md
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const R = process.argv[2] ?? "benchmarks/2026-10-27-gate-d-rerun/runs";
const GATE_D = process.argv[3] ?? "benchmarks/2026-10-21-gate-d/runs";
type Rec = { title: string; page: string | null; status: string; message: string; skipReason: string; findings: string[]; issues?: string[] };
type Run = { runSeconds: number; workers: number; workersUsed: number | null; tests: number; units?: number; passes?: number; serialTests?: number; byStatus: Record<string, number>; requestCap: { requests: number; waited: number; waitedMs: number } | null; timeouts: string[]; records: Rec[] };
const LABELS = ["fixture", "with-bugs", "clean", "practicesoftwaretesting", "cap-fixture"];
const LOCAL = ["fixture", "with-bugs", "clean"];
const VARIANTS = ["W1", "WN", "W3", "CAP"];
const KINDS = ["standard", "security", "accessibility"];
const readIn = (dir: string, variant: string, label: string, kind: string, run: number): Run | null => {
    const file = join(dir, variant, `${label}-${kind}-run${run}-records.json`);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Run) : null;
};
const read = (variant: string, label: string, kind: string, run: number) => readIn(R, variant, label, kind, run);
const runsIn = (dir: string, variant: string, label: string, kind: string) => [1, 2, 3].map((run) => readIn(dir, variant, label, kind, run)).filter((run): run is Run => run !== null);
const runs = (variant: string, label: string, kind: string) => runsIn(R, variant, label, kind);
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
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
// run.mts's timeouts count a test's, an action's or a navigation's; a fixture's teardown or an afterAll hook running out
// of time ("Tearing down "context" exceeded the test timeout", ""afterAll" hook timeout of 30000ms exceeded") is a
// timeout too, and the dry run's clean WN security had 9 of them that run.mts didn't count. Counted here from the
// records, the same way for this session, its dry run and Gate D; run.mts's own count is shown beside it.
const TIMED_OUT = /Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|timed out after \d+|exceeded the test timeout|hook timeout of \d+ms exceeded/i;
const timeoutsOf = (run: Run) => run.records.filter((record) => record.status === "Failed" && TIMED_OUT.test(record.message ?? "")).length;
const timeoutCell = (run: Run) => `${timeoutsOf(run)}${timeoutsOf(run) !== run.timeouts.length ? ` (run.mts: ${run.timeouts.length})` : ""}`;

/** Decision 7 between two variants' runs: Gate B's method. */
function sameResults(left: string, right: string, label: string, kind: string): { lines: string[]; same: boolean } | null {
    const a = runs(left, label, kind), b = runs(right, label, kind);
    if (!a.length || !b.length) return null;
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
            `- 30 s timeouts: ${left} ${a.map(timeoutCell).join("/")}, ${right} ${b.map(timeoutCell).join("/")}.`,
            ...onlyA.map((item) => `  - failing in ${left} only: ${item}`), ...onlyB.map((item) => `  - failing in ${right} only: ${item}`),
            ...fOnlyA.slice(0, 10).map((item) => `  - finding in ${left} only: ${item}`), ...fOnlyB.slice(0, 10).map((item) => `  - finding in ${right} only: ${item}`),
        ],
    };
}

const out: string[] = ["# Phase 39 Gate D's re-measurement: the numbers", "", "Medians of three runs (one for the capped run); each run's time in seconds, in run order. Gate D's own medians (`benchmarks/2026-10-21-gate-d/`) beside them where it ran the same.", ""];
const labels = LABELS.filter((label) => VARIANTS.some((variant) => KINDS.some((kind) => runs(variant, label, kind).length)));
out.push("## Run times", "", `| Copy | Suite | ${VARIANTS.join(" | ")} | Gate D W1 | Gate D WN |`, `| --- | --- | ${VARIANTS.map(() => "---").join(" | ")} | --- | --- |`);
for (const label of labels) for (const kind of KINDS) {
    if (!VARIANTS.some((variant) => runs(variant, label, kind).length)) continue;
    out.push(`| ${label} | ${kind} | ${VARIANTS.map((variant) => cell(runs(variant, label, kind))).join(" | ")} | ${cell(runsIn(GATE_D, "W1", label, kind))} | ${cell(runsIn(GATE_D, "WN", label, kind))} |`);
}
for (const variant of ["WN", "W3"]) {
    const run = labels.map((label) => runs(variant, label, "standard")[0]).find(Boolean);
    if (run) out.push("", `${variant}: ${run.workers} workers (${run.workersUsed ?? "?"} used), Standard as ${run.units} unit file(s) in ${run.passes} pass(es), ${run.serialTests} test(s) in the serial group (run 1).`);
}

const verdicts: string[] = [];
const sections: string[] = [];
// Decision 12, the same results with 1 and N workers: the fixture decides (Decision 13's rule); the copies are AC 7.
const same: Record<string, boolean> = {};
for (const other of ["WN", "W3"]) for (const label of labels.filter((entry) => LOCAL.includes(entry))) {
    for (const kind of KINDS) {
        const results = sameResults("W1", other, label, kind);
        if (!results) continue;
        same[`${other} ${label} ${kind}`] = results.same;
        sections.push(`### W1 against ${other}, ${label} ${kind}`, "", ...results.lines, "");
    }
}
const fixtureSame = KINDS.every((kind) => same[`WN fixture ${kind}`] !== false) && KINDS.some((kind) => `WN fixture ${kind}` in same);
verdicts.push(`- Decision 12, the fixture: every test the same result with 1 and with N workers: **${fixtureSame ? "yes" : "no, see below"}** (${KINDS.map((kind) => `${kind} ${same[`WN fixture ${kind}`] === undefined ? "not run" : same[`WN fixture ${kind}`] ? "same" : "differs"}`).join(", ")}).`);
for (const other of ["WN", "W3"]) for (const label of ["with-bugs", "clean"].filter((entry) => labels.includes(entry))) {
    if (!KINDS.some((kind) => `${other} ${label} ${kind}` in same)) continue;
    verdicts.push(`- Acceptance Criteria 7, ${label}, W1 against ${other}: ${KINDS.map((kind) => `${kind} ${same[`${other} ${label} ${kind}`] === undefined ? "not run" : same[`${other} ${label} ${kind}`] ? "same" : "differs"}`).join(", ")}.`);
}

// Decision 13: Comprehensive, every area: each round's security and accessibility together, medians of the sums.
const comprehensive = (dir: string, variant: string, label: string) => [1, 2, 3].map((run) => [readIn(dir, variant, label, "security", run), readIn(dir, variant, label, "accessibility", run)]).filter(([sec, acc]) => sec && acc).map(([sec, acc]) => sec!.runSeconds + acc!.runSeconds);
for (const label of ["with-bugs", "clean"].filter((entry) => labels.includes(entry))) {
    const one = comprehensive(R, "W1", label);
    if (!one.length) continue;
    const before = (variant: string) => { const list = comprehensive(GATE_D, variant, label); return list.length ? `${median(list)} s` : "-"; };
    for (const other of ["WN", "W3"]) {
        const many = comprehensive(R, other, label);
        if (!many.length) continue;
        const change = 1 - median(many) / median(one);
        const verdict = other === "WN" ? `; with the fixture's same results: **${change >= 0.4 && fixtureSame ? "met" : "not met"}**` : " (recorded)";
        verdicts.push(`- **Decision 13, ${label}, W1 against ${other}:** Comprehensive, every area (security + accessibility): W1 ${median(one)} s (${one.join(", ")}), ${other} ${median(many)} s (${many.join(", ")}), ${pct(change)} faster against at least 40%${verdict}. Gate D: W1 ${before("W1")}, WN ${before("WN")}.`);
    }
}
// Standard, recorded: W1 against WN and W3 on each local copy.
for (const label of labels.filter((entry) => LOCAL.includes(entry))) {
    const a = medianOf(runs("W1", label, "standard"));
    for (const other of ["WN", "W3"]) {
        const n = medianOf(runs(other, label, "standard"));
        if (a !== null && n !== null) verdicts.push(`- Standard, ${label}, W1 against ${other} (recorded): W1 ${a} s, ${other} ${n} s, ${pct(1 - n / a)} faster.`);
    }
}

// The capped run (practicesoftwaretesting.com; cap-fixture in the dry run): recorded, with its timeouts.
for (const label of ["practicesoftwaretesting", "cap-fixture"].filter((entry) => labels.includes(entry))) {
    for (const kind of KINDS) {
        const run = runs("CAP", label, kind)[0];
        if (!run) continue;
        const notJudged = run.records.filter((record) => record.status === "Not run" && /not judged under the request cap/.test(record.skipReason)).length;
        const cap = run.requestCap;
        const before = runsIn(GATE_D, "CAP", label, kind)[0];
        verdicts.push(`- Capped, ${label} ${kind} (recorded): ${run.runSeconds} s, ${run.workers} workers (${run.workersUsed ?? "?"} used), ${run.tests} tests ${JSON.stringify(run.byStatus)}; ${cap ? `${cap.requests} requests took a slot, ${cap.waited} waited (${Math.round(cap.waitedMs / 1000)} s in all), ${(cap.requests / run.runSeconds).toFixed(2)} per second over the run` : "no cap recorded"}; timed checks not judged ${notJudged}; timeouts ${timeoutCell(run)}${before ? `. Gate D: ${before.runSeconds} s, timeouts ${timeoutCell(before)}` : ""}.`);
        if (run.timeouts.length) sections.push(`### Timeouts, capped ${label} ${kind}`, "", ...run.timeouts.map((item) => `- ${item}`), "");
    }
}

out.push("", "## Against the rules", "", ...verdicts, "", "## Decision 7 and Decision 12: the same results; timeouts", "", ...sections);
console.log(out.join("\n"));
