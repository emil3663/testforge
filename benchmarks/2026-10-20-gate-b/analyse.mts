// Phase 39 Gate B: the session's numbers against the targets locked at Gate A (phase-39-run-concurrency-decision-record.md).
// - Gate B: A (before) against C (TFP-212, TFP-213, TFP-215), medians of three: Standard at least 20% faster on each
//   copy, Comprehensive security and accessibility each at least 30%.
// - TFP-215: B (TFP-212, TFP-213) against C, with-bugs Standard: at least 5% of B's median.
// - Decision 7's proof: each copy's failures, test by test (title and page, a clean product's id set aside), the same
//   in A and C, and stable across runs; findings likewise. The Toolshop score: TFP-207's evidence script's items for
//   with-bugs, A against C (keys, so the same evidence from the same checks).
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-gate-b/analyse.mts > benchmarks/2026-10-20-gate-b/analysis.md
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const R = "benchmarks/2026-10-20-gate-b/runs";
type Rec = { title: string; page: string | null; status: string; message: string; findings: string[]; issues?: string[] };
type Run = { runSeconds: number; tests: number; byStatus: Record<string, number>; records: Rec[] };
const read = (variant: string, label: string, kind: string, run: number): Run | null => {
    const file = join(R, variant, `${label}-${kind}-run${run}-records.json`);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Run) : null;
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const runs = (variant: string, label: string, kind: string) => [1, 2, 3].map((run) => read(variant, label, kind, run)).filter((run): run is Run => run !== null);
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

const out: string[] = ["# Phase 39 Gate B: the numbers", "", "Medians of three runs; each run's time in seconds, in run order.", ""];
out.push("## Run times", "", "| Copy | Suite | A (before) | B (TFP-212, 213) | C (+ TFP-215) | A to C |", "| --- | --- | --- | --- | --- | --- |");
const verdicts: string[] = [];
for (const label of ["with-bugs", "clean"]) {
    for (const kind of ["standard", "security", "accessibility"]) {
        const cell = (variant: string) => {
            const list = runs(variant, label, kind);
            return list.length ? `${median(list.map((run) => run.runSeconds))} (${list.map((run) => run.runSeconds).join(", ")})` : "-";
        };
        const a = runs("A", label, kind), c = runs("C", label, kind);
        const change = a.length && c.length ? 1 - median(c.map((run) => run.runSeconds)) / median(a.map((run) => run.runSeconds)) : null;
        out.push(`| ${label} | ${kind} | ${cell("A")} | ${cell("B")} | ${cell("C")} | ${change === null ? "-" : `${(change * 100).toFixed(1)}% faster`} |`);
        if (change !== null) {
            const target = kind === "standard" ? 0.2 : 0.3;
            verdicts.push(`- Gate B, ${label} ${kind}: ${(change * 100).toFixed(1)}% faster against a target of ${target * 100}%: **${change >= target ? "met" : "not met"}**.`);
        }
    }
}
const b = runs("B", "with-bugs", "standard"), c = runs("C", "with-bugs", "standard");
if (b.length && c.length) {
    const saving = 1 - median(c.map((run) => run.runSeconds)) / median(b.map((run) => run.runSeconds));
    verdicts.push(`- TFP-215, with-bugs Standard: C ${(saving * 100).toFixed(1)}% faster than B (${median(b.map((run) => run.runSeconds))} s to ${median(c.map((run) => run.runSeconds))} s) against a bar of 5%: **${saving >= 0.05 ? "kept" : "reverted"}**.`);
}
out.push("", "## Against the targets", "", ...verdicts, "");

out.push("## Decision 7: the same results", "");
for (const label of ["with-bugs", "clean"]) {
    for (const kind of ["standard", "security", "accessibility"]) {
        const a = runs("A", label, kind), cRuns = runs("C", label, kind);
        if (!a.length || !cRuns.length) continue;
        const stable = (list: Run[]) => list.every((run) => difference(failures(run), failures(list[0])).length === 0 && difference(failures(list[0]), failures(run)).length === 0);
        // A test whose failures or findings differ between runs of the same variant varies from load to load (a timed
        // check, a with-bugs bug that randomises its page); its differences between A and C are listed apart, not counted.
        const testOf = (item: string) => item.split(" | ")[0].replace(/ \(x\d+\)$/, "");
        const varying = new Set<string>();
        for (const list of [a, cRuns]) for (const run of list.slice(1)) for (const pick of [failures, findings]) {
            for (const item of [...difference(pick(run), pick(list[0])), ...difference(pick(list[0]), pick(run))]) varying.add(testOf(item));
        }
        const split = (items: string[]) => [items.filter((item) => !varying.has(testOf(item))), items.filter((item) => varying.has(testOf(item)))];
        const [onlyA, onlyAVarying] = split(difference(failures(a[0]), failures(cRuns[0]))), [onlyC, onlyCVarying] = split(difference(failures(cRuns[0]), failures(a[0])));
        const [fOnlyA, fOnlyAVarying] = split(difference(findings(a[0]), findings(cRuns[0]))), [fOnlyC, fOnlyCVarying] = split(difference(findings(cRuns[0]), findings(a[0])));
        const total = (run: Run) => [...failures(run).values()].reduce((sum, count) => sum + count, 0);
        out.push(`### ${label}, ${kind}`, "",
            `- Failures: A ${a.map(total).join("/")}, C ${cRuns.map(total).join("/")}; the same in every run: A ${stable(a) ? "yes" : "no"}, C ${stable(cRuns) ? "yes" : "no"}.`,
            `- Run 1, A against C, tests that give the same in every run of each: ${onlyA.length} failing in A only, ${onlyC.length} in C only; findings ${fOnlyA.length} in A only, ${fOnlyC.length} in C only.`,
            `- Tests that vary between runs of one variant: ${varying.size}${varying.size ? ` (${[...varying].map((test) => test.slice(0, 90)).join("; ")})` : ""}; their A-against-C differences in run 1: failures ${onlyAVarying.length + onlyCVarying.length}, findings ${fOnlyAVarying.length + fOnlyCVarying.length}.`,
            ...onlyA.map((item) => `  - failing in A only: ${item}`), ...onlyC.map((item) => `  - failing in C only: ${item}`),
            ...fOnlyA.slice(0, 10).map((item) => `  - finding in A only: ${item}`), ...fOnlyC.slice(0, 10).map((item) => `  - finding in C only: ${item}`), "");
    }
}

// The score: TFP-207's evidence script on run 1 of each variant, with-bugs against clean, and its items compared.
const evidence = resolve("benchmarks/2026-10-15-tfp207-regression/evidence.mjs");
const scratch = mkdtempSync(join(tmpdir(), "gate-b-evidence-"));
try {
    const items: Record<string, string> = {};
    for (const variant of ["A", "C"]) {
        for (const label of ["with-bugs", "clean"]) {
            const run = read(variant, label, "standard", 1);
            if (!run) continue;
            writeFileSync(join(scratch, `${variant}-${label}-standard-records.json`), JSON.stringify({ records: run.records.map((record) => ({ ...record, issues: record.issues ?? [] })) }));
        }
        if (existsSync(join(scratch, `${variant}-with-bugs-standard-records.json`)) && existsSync(join(scratch, `${variant}-clean-standard-records.json`))) {
            items[variant] = execFileSync(process.execPath, [evidence, `${variant}-with-bugs`, `${variant}-clean`], { cwd: scratch, encoding: "utf8" });
        }
    }
    if (items.A && items.C) {
        const lines = (text: string) => new Set(text.split("\n").map((line) => line.replace(/TF[A-Z]+-\d+: /g, "").replace(/\s+\(\d+ ms\)/g, "").trim()).filter(Boolean));
        const [a, cItems] = [lines(items.A), lines(items.C)];
        const onlyA = [...a].filter((line) => !cItems.has(line)), onlyC = [...cItems].filter((line) => !a.has(line));
        const perBug = (text: string) => [...text.matchAll(/^== (\d+): (\d+) item/gm)].map((match) => `${match[1]}:${match[2]}`).join(" ");
        out.push("## The Toolshop score's evidence (TFP-207's evidence.mjs, run 1)", "",
            `- Items per bug, A: ${perBug(items.A)}`, `- Items per bug, C: ${perBug(items.C)}`,
            `- Evidence lines in A only: ${onlyA.length}; in C only: ${onlyC.length}.`,
            ...onlyA.slice(0, 20).map((line) => `  - A only: ${line.slice(0, 220)}`), ...onlyC.slice(0, 20).map((line) => `  - C only: ${line.slice(0, 220)}`),
            "- with-bugs records from the session carry no manual-review items (the with-bugs half's run.mts kept none); bug 46's are checked by the axe scans alone, A against C (bug-46.md).", "");
    }
} finally {
    rmSync(scratch, { recursive: true, force: true });
}
console.log(out.join("\n"));
