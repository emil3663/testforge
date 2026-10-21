// Phase 39 Gate D (TFP-158): the session's numbers against the record's rules (phase-39-run-concurrency-decision-record.md).
//   Decision 13   Comprehensive, every area (security and accessibility), on the local Toolshop: WN at least 40%
//                 faster than W1, medians of three (Gate A target 4); with Decision 12: on the fixture, every test the
//                 same result with 1 and N workers. Otherwise reverted; recorded either way.
//   Decision 12   the same results W1 against WN, on the fixture and every local copy (Acceptance Criteria 7), Gate
//                 B's method (failures and findings, test by test; a test that varies between runs of one variant
//                 listed apart).
//   Gate C ruling 2  with-bugs accessibility: A (before TFP-212, 1 worker) against WN, the 30% Gate C missed.
//   Phase 38      its before and after on the local the-internet copy: P38B (d90de57) against P38A (d202315), Standard,
//                 one worker, each with its own inspection; the new failures listed.
//   Decision 13   the capped run on practicesoftwaretesting.com: its time and requests per second, recorded, not
//                 judged; with its timeouts on heavy pages (Emil, 2026-10-21) and its timed checks Not run.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-gate-d/analyse.mts [<runsDir>] > benchmarks/2026-10-21-gate-d/analysis.md
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const R = process.argv[2] ?? "benchmarks/2026-10-21-gate-d/runs";
type Rec = { title: string; page: string | null; status: string; message: string; skipReason: string; findings: string[]; issues?: string[] };
type Run = { runSeconds: number; workers: number; workersUsed: number | null; tests: number; units?: number; passes?: number; serialTests?: number; byStatus: Record<string, number>; requestCap: { requests: number; waited: number; waitedMs: number } | null; timeouts: string[]; records: Rec[] };
const LABELS = ["fixture", "with-bugs", "clean", "the-internet", "practicesoftwaretesting", "cap-fixture"];
const VARIANTS = ["W1", "WN", "CAP", "A", "P38B", "P38A"];
const KINDS = ["standard", "security", "accessibility"];
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
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

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
            ...onlyA.map((item) => `  - failing in ${left} only: ${item}`), ...onlyB.map((item) => `  - failing in ${right} only: ${item}`),
            ...fOnlyA.slice(0, 10).map((item) => `  - finding in ${left} only: ${item}`), ...fOnlyB.slice(0, 10).map((item) => `  - finding in ${right} only: ${item}`),
        ],
    };
}

const out: string[] = ["# Phase 39 Gate D: the numbers", "", "Medians of three runs (one for the capped run); each run's time in seconds, in run order.", ""];
const labels = LABELS.filter((label) => VARIANTS.some((variant) => KINDS.some((kind) => runs(variant, label, kind).length)));
out.push("## Run times", "", `| Copy | Suite | ${VARIANTS.join(" | ")} |`, `| --- | --- | ${VARIANTS.map(() => "---").join(" | ")} |`);
for (const label of labels) for (const kind of KINDS) {
    if (!VARIANTS.some((variant) => runs(variant, label, kind).length)) continue;
    out.push(`| ${label} | ${kind} | ${VARIANTS.map((variant) => cell(runs(variant, label, kind))).join(" | ")} |`);
}
const wn = labels.map((label) => runs("WN", label, "standard")[0]).find(Boolean);
if (wn) out.push("", `WN: ${wn.workers} workers (${wn.workersUsed ?? "?"} used), Standard as ${wn.units} unit file(s) in ${wn.passes} pass(es), ${wn.serialTests} test(s) in the serial group (run 1).`);

const verdicts: string[] = [];
const sections: string[] = [];
// Decision 12, the same results with 1 and N workers: the fixture decides (Decision 13's rule); the copies are AC 7.
const same: Record<string, boolean> = {};
for (const label of labels.filter((entry) => !["practicesoftwaretesting", "cap-fixture"].includes(entry))) {
    for (const kind of KINDS) {
        const results = sameResults("W1", "WN", label, kind);
        if (!results) continue;
        same[`${label} ${kind}`] = results.same;
        sections.push(`### W1 against WN, ${label} ${kind}`, "", ...results.lines, "");
    }
}
const fixtureSame = KINDS.every((kind) => same[`fixture ${kind}`] !== false) && KINDS.some((kind) => `fixture ${kind}` in same);
verdicts.push(`- Decision 12, the fixture: every test the same result with 1 and with N workers: **${fixtureSame ? "yes" : "no, see below"}** (${KINDS.map((kind) => `${kind} ${same[`fixture ${kind}`] === undefined ? "not run" : same[`fixture ${kind}`] ? "same" : "differs"}`).join(", ")}).`);
for (const label of ["with-bugs", "clean", "the-internet"].filter((entry) => labels.includes(entry))) {
    verdicts.push(`- Acceptance Criteria 7, ${label}: ${KINDS.map((kind) => `${kind} ${same[`${label} ${kind}`] === undefined ? "not run" : same[`${label} ${kind}`] ? "same" : "differs"}`).join(", ")}.`);
}

// Decision 13: Comprehensive, every area: each round's security and accessibility together, medians of the sums.
for (const label of ["with-bugs", "clean"].filter((entry) => labels.includes(entry))) {
    const rounds = (variant: string) => [1, 2, 3].map((run) => [read(variant, label, "security", run), read(variant, label, "accessibility", run)]).filter(([sec, acc]) => sec && acc).map(([sec, acc]) => sec!.runSeconds + acc!.runSeconds);
    const one = rounds("W1"), many = rounds("WN");
    if (!one.length || !many.length) continue;
    const change = 1 - median(many) / median(one);
    const keep = change >= 0.4 && fixtureSame;
    verdicts.push(`- **Decision 13, ${label}:** Comprehensive, every area (security + accessibility): W1 ${median(one)} s (${one.join(", ")}), WN ${median(many)} s (${many.join(", ")}), ${pct(change)} faster against at least 40%; with the fixture's same results: **${keep ? "kept" : "not met: reverted"}**.`);
}
// Gate C ruling 2: with-bugs accessibility, A against WN.
for (const label of ["with-bugs"].filter((entry) => labels.includes(entry))) {
    const a = medianOf(runs("A", label, "accessibility")), n = medianOf(runs("WN", label, "accessibility"));
    if (a !== null && n !== null) verdicts.push(`- Gate C's accessibility gap, ${label}: A (before TFP-212, 1 worker) ${a} s, WN ${n} s, ${pct(1 - n / a)} faster against Gate C's 30%: **${1 - n / a >= 0.3 ? "closed" : "still open"}**.`);
}
// Standard, recorded: W1 against WN on each local copy.
for (const label of labels.filter((entry) => !["practicesoftwaretesting", "cap-fixture"].includes(entry))) {
    const a = medianOf(runs("W1", label, "standard")), n = medianOf(runs("WN", label, "standard"));
    if (a !== null && n !== null) verdicts.push(`- Standard, ${label} (recorded): W1 ${a} s, WN ${n} s, ${pct(1 - n / a)} faster.`);
}

// Phase 38's before and after on the-internet's local copy.
const before = runs("P38B", "the-internet", "standard"), after = runs("P38A", "the-internet", "standard");
if (before.length && after.length) {
    const count = (run: Run, status: string) => run.byStatus[status] ?? 0;
    const newFailures = difference(failures(after[0]), failures(before[0]));
    verdicts.push(`- Phase 38 on the-internet's local copy: d90de57 ${medianOf(before)} s (${before.map((run) => run.runSeconds).join(", ")}), d202315 ${medianOf(after)} s (${after.map((run) => run.runSeconds).join(", ")}).`);
    sections.push("### Phase 38's before and after, the-internet's local copy", "",
        `- Tests: before ${before.map((run) => run.tests).join("/")}, after ${after.map((run) => run.tests).join("/")}; failed before ${before.map((run) => count(run, "Failed")).join("/")}, after ${after.map((run) => count(run, "Failed")).join("/")}; 30 s timeouts before ${before.map((run) => run.timeouts.length).join("/")}, after ${after.map((run) => run.timeouts.length).join("/")}.`,
        `- New failures in the after run (run 1; a test failing after whose title wasn't failing before): ${newFailures.length}.`,
        ...newFailures.map((item) => `  - ${item}`), "");
}

// The capped run (practicesoftwaretesting.com; cap-fixture in the dry run): recorded, with its timeouts.
for (const label of ["practicesoftwaretesting", "cap-fixture"].filter((entry) => labels.includes(entry))) {
    for (const kind of KINDS) {
        const run = runs("CAP", label, kind)[0];
        if (!run) continue;
        const notJudged = run.records.filter((record) => record.status === "Not run" && /not judged under the request cap/.test(record.skipReason)).length;
        const cap = run.requestCap;
        verdicts.push(`- Capped, ${label} ${kind} (recorded): ${run.runSeconds} s, ${run.workers} workers (${run.workersUsed ?? "?"} used), ${run.tests} tests ${JSON.stringify(run.byStatus)}; ${cap ? `${cap.requests} requests took a slot, ${cap.waited} waited (${Math.round(cap.waitedMs / 1000)} s in all), ${(cap.requests / run.runSeconds).toFixed(2)} per second over the run` : "no cap recorded"}; timed checks not judged ${notJudged}; timeouts ${run.timeouts.length}.`);
        if (run.timeouts.length) sections.push(`### Timeouts, capped ${label} ${kind}`, "", ...run.timeouts.map((item) => `- ${item}`), "");
    }
}

out.push("", "## Against the rules", "", ...verdicts, "", "## Decision 7 and Decision 12: the same results; Phase 38; timeouts", "", ...sections);
console.log(out.join("\n"));
