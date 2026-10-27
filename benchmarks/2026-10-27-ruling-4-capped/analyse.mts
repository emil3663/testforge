// Gate D's re-measurement ruling 4 (Emil, 2026-10-27): the session's numbers against the ruling's pre-set outcome.
//   Same results  every test the same result capped (CAP) and uncapped (W1), Gate B's method (failures and findings,
//                 test by test, run 1 against run 1; a test that varies between runs of one variant listed apart, as
//                 Decision 7 allows). The timed checks CAP reports Not run "not judged under the request cap" are an
//                 owner decision (2026-10-21), so they are listed apart too, not counted as differences.
//   Outcome       same: the capped budget is 60 minutes and a capped timeout is reported Not run; different: the shared
//                 assertion wait and the test timeout are lengthened by the mean slot wait measured here.
//   Recorded      each pass's time, timeouts (from the records, teardown and afterAll included), and CAP's slots, waits,
//                 mean slot wait and requests per second.
// CAP's suites are W1's with the page origin rewritten, so CAP's origin is mapped back to loopback before comparing.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-27-ruling-4-capped/analyse.mts [<runsDir>] > benchmarks/2026-10-27-ruling-4-capped/analysis.md
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const R = process.argv[2] ?? "benchmarks/2026-10-27-ruling-4-capped/runs";
const LABEL = "with-bugs";
const KINDS = ["standard", "security", "accessibility"];
type Rec = { title: string; page: string | null; status: string; message: string; skipReason: string; findings: string[] };
type Run = { site: string; runSeconds: number; workers: number; workersUsed: number | null; tests: number; byStatus: Record<string, number>; requestCap: { requests: number; waited: number; waitedMs: number } | null; capDomain?: string | null; timeouts: string[]; records: Rec[] };
const runs = (variant: string, kind: string) => [1, 2, 3].map((run) => join(R, variant, `${LABEL}-${kind}-run${run}-records.json`)).filter(existsSync).map((file) => JSON.parse(readFileSync(file, "utf8")) as Run);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const cell = (list: Run[]) => (list.length ? `${median(list.map((run) => run.runSeconds))} (${list.map((run) => run.runSeconds).join(", ")})` : "-");

const loopback = runs("W1", "standard")[0]?.site ?? "http://localhost:4200";
const capSite = runs("CAP", "standard")[0]?.site ?? "";
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toLoopback = capSite ? new RegExp(escape(capSite), "g") : null;
const norm = (text: string) => (toLoopback ? text.replace(toLoopback, loopback) : text).replace(/^TF[A-Z]+-\d+: /, "").replace(/01[0-9A-Z]{24}/g, "<id>");
const key = (record: Rec) => `${norm(record.title)} @${norm(record.page ?? "")}`;
const NOT_JUDGED = /not judged under the request cap/;
const TIMED_OUT = /Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|timed out after \d+|exceeded the test timeout|hook timeout of \d+ms exceeded/i;
const timeoutsOf = (run: Run) => run.records.filter((record) => record.status === "Failed" && TIMED_OUT.test(record.message ?? "")).length;

function multiset(records: Rec[], pick: (record: Rec) => string[]) {
    const counts = new Map<string, number>();
    for (const record of records) for (const item of pick(record)) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
}
function difference(left: Map<string, number>, right: Map<string, number>) {
    const out: string[] = [];
    for (const [item, count] of left) if (count > (right.get(item) ?? 0)) out.push(item + (count - (right.get(item) ?? 0) > 1 ? ` (x${count - (right.get(item) ?? 0)})` : ""));
    return out;
}

const out: string[] = ["# Ruling 4's capped experiment: the numbers", "", `with-bugs, W1 (1 worker, uncapped, ${loopback}) against CAP (the capped row, ${capSite || "?"}); each run's time in seconds, in run order, median first.`, ""];
out.push("## Run times and the cap", "", "| Suite | W1 | CAP | CAP timeouts | CAP slots | CAP waited | CAP mean slot wait | CAP requests per second | W1 timeouts |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
let slotWaitMs = 0, slotWaits = 0;
for (const kind of KINDS) {
    const a = runs("W1", kind), b = runs("CAP", kind);
    if (!a.length && !b.length) continue;
    const caps = b.map((run) => run.requestCap).filter((cap): cap is NonNullable<Run["requestCap"]> => cap !== null);
    for (const cap of caps) { slotWaitMs += cap.waitedMs; slotWaits += cap.waited; }
    out.push(`| ${kind} | ${cell(a)} | ${cell(b)} | ${b.map(timeoutsOf).join("/") || "-"} | ${caps.map((cap) => cap.requests).join("/") || "-"} | ${caps.map((cap) => cap.waited).join("/") || "-"} | ${caps.map((cap) => `${(cap.waitedMs / Math.max(1, cap.waited) / 1000).toFixed(2)} s`).join("/") || "-"} | ${b.map((run, i) => (caps[i] ? (caps[i].requests / run.runSeconds).toFixed(2) : "-")).join("/") || "-"} | ${a.map(timeoutsOf).join("/") || "-"} |`);
}
const meanWait = slotWaits ? slotWaitMs / slotWaits / 1000 : null;
const capRound = (run: number) => KINDS.map((kind) => runs("CAP", kind)[run - 1]?.runSeconds).filter((value): value is number => value !== undefined);
const roundTotals = [1, 2, 3].map(capRound).filter((list) => list.length === KINDS.length).map((list) => list.reduce((sum, value) => sum + value, 0));
out.push("", `CAP counts: ${JSON.stringify(runs("CAP", "standard")[0]?.capDomain ?? null)} ("" is every request). Mean slot wait over every CAP pass: ${meanWait === null ? "-" : `${meanWait.toFixed(2)} s`} (${slotWaits} waits). CAP's three suites per round: ${roundTotals.length ? roundTotals.map((total) => `${total} s`).join(", ") : "-"}, against the 60-minute budget.`);

out.push("", "## The same results, capped and uncapped", "");
const sections: string[] = [];
let allSame = true, compared = 0;
for (const kind of KINDS) {
    const a = runs("W1", kind), b = runs("CAP", kind);
    if (!a.length || !b.length) continue;
    compared++;
    const notJudged = new Set(b.flatMap((run) => run.records.filter((record) => record.status === "Not run" && NOT_JUDGED.test(record.skipReason)).map(key)));
    const kept = (run: Run) => run.records.filter((record) => !notJudged.has(key(record)));
    const failures = (run: Run) => multiset(kept(run), (record) => (record.status === "Failed" ? [key(record)] : []));
    const findings = (run: Run) => multiset(kept(run), (record) => record.findings.map((finding) => `${key(record)} | ${norm(finding)}`));
    const statuses = (run: Run) => multiset(kept(run), (record) => [`${key(record)} => ${record.status}`]);
    const testOf = (item: string) => item.split(" | ")[0].split(" => ")[0].replace(/ \(x\d+\)$/, "");
    const varying = new Set<string>();
    for (const list of [a, b]) for (const run of list.slice(1)) for (const pick of [failures, findings, statuses]) {
        for (const item of [...difference(pick(run), pick(list[0])), ...difference(pick(list[0]), pick(run))]) varying.add(testOf(item));
    }
    const steady = (items: string[]) => items.filter((item) => !varying.has(testOf(item)));
    const onlyA = steady(difference(failures(a[0]), failures(b[0]))), onlyB = steady(difference(failures(b[0]), failures(a[0])));
    const fOnlyA = steady(difference(findings(a[0]), findings(b[0]))), fOnlyB = steady(difference(findings(b[0]), findings(a[0])));
    const sOnlyA = steady(difference(statuses(a[0]), statuses(b[0]))), sOnlyB = steady(difference(statuses(b[0]), statuses(a[0])));
    const same = onlyA.length + onlyB.length + fOnlyA.length + fOnlyB.length + sOnlyA.length + sOnlyB.length === 0;
    allSame &&= same;
    const total = (run: Run) => [...failures(run).values()].reduce((sum, count) => sum + count, 0);
    out.push(`- ${kind}: **${same ? "same" : "differs"}** (failures W1 ${a.map(total).join("/")}, CAP ${b.map(total).join("/")}; ${varying.size} test(s) vary between runs of one variant; ${notJudged.size} timed check(s) Not run under the cap, listed apart).`);
    sections.push(`### ${kind}`, "",
        `- Timed checks Not run under the cap (owner decision 2026-10-21): ${notJudged.size ? [...notJudged].map((item) => item.slice(0, 90)).join("; ") : "none"}.`,
        `- Tests that vary between runs of one variant: ${varying.size ? [...varying].map((item) => item.slice(0, 90)).join("; ") : "none"}.`,
        ...onlyA.map((item) => `  - failing in W1 only: ${item}`), ...onlyB.map((item) => `  - failing in CAP only: ${item}`),
        ...sOnlyB.slice(0, 20).map((item) => `  - status in CAP only: ${item}`),
        ...sOnlyA.slice(0, 20).map((item) => `  - status in W1 only: ${item}`),
        ...fOnlyA.slice(0, 10).map((item) => `  - finding in W1 only: ${item}`), ...fOnlyB.slice(0, 10).map((item) => `  - finding in CAP only: ${item}`),
        ...b.flatMap((run, i) => run.timeouts.map((item) => `  - CAP run ${i + 1} timed out: ${item.slice(0, 120)}`)),
        "");
}
const outcome = !compared ? "not measured" : allSame
    ? "**same**: the capped budget is 60 minutes, and a test that times out on a capped host is reported Not run, \"needs more requests than the request cap allows in its time\""
    : `**different**: on a capped host the shared assertion wait and the test timeout are lengthened by the mean slot wait measured here (${meanWait === null ? "-" : `${meanWait.toFixed(2)} s`}), re-checked once; any test still different is reported Not run under the request cap; the budget is 60 minutes`;
out.push("", `**Ruling 4's outcome, as set in advance:** ${outcome}.`, "", "## Per suite", "", ...sections);
console.log(out.join("\n"));
