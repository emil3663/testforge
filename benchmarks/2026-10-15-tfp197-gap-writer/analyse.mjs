// TFP-197: the measures Emil asked for (2026-10-15), read from runs/. No browser, no network, no model.
//   1. Claude Code calls, cost and time per run (each run's claude-calls.jsonl and records);
//   2. each run's site suite record: reused, generated, regenerated, retired; gaps asked, saved, not kept;
//      candidates bound on Standard (TFP-203);
//   3. which of run 1's gap tests run 3 reused, and which it retired because their page type is gone;
//   4. every failure in run 3 of a test written in run 1 (a reused gap test, or a candidate bound or tried),
//      to be matched to a benchmark bug or labelled by hand;
//   5. every failing attempt not kept, with its last message, to be read by hand as a possible hint;
//   6. run 1's and run 3's failures that Gate B's matching run (TFP-188) didn't have.
// Usage (from this folder): node analyse.mjs > analysis.txt
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const R = "runs";
const RUNS = ["run1-clean", "run2-clean", "run3-with-bugs", "run4-with-bugs"];
const read = (file) => (existsSync(join(R, file)) ? JSON.parse(readFileSync(join(R, file), "utf8")) : null);
const lines = (file) => (existsSync(join(R, file)) ? readFileSync(join(R, file), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
const kind = (prompt) => (prompt.startsWith("Write the body") ? "write" : prompt.startsWith("Generalise") ? "generalise" : prompt.startsWith("The test") ? "revise" : "other");
const failed = (record) => record.status === "Failed" || record.status === "Blocked";
const strip = (title) => title.replace(/^TF[A-Z]+-\d+: /, "").replace(/\/product\/[0-9A-Z]{26}/g, "/product/:id").replace(/\/#\//g, "/");
const out = (text = "") => console.log(text);

out("== 1. Claude Code calls, cost and time per run");
for (const run of RUNS) {
    const records = read(`${run}-records.json`);
    if (!records) continue;
    const calls = lines(`${run}-claude-calls.jsonl`);
    const byKind = calls.reduce((map, call) => ((map[kind(call.prompt)] = (map[kind(call.prompt)] ?? 0) + 1), map), {});
    const cost = calls.reduce((sum, call) => sum + (call.reply?.total_cost_usd ?? 0), 0);
    const seconds = calls.reduce((sum, call) => sum + call.ms, 0) / 1000;
    const models = [...new Set(calls.flatMap((call) => Object.keys(call.reply?.modelUsage ?? {})))];
    const failedCalls = calls.filter((call) => call.exit !== 0 || call.reply?.is_error).length;
    out(`${run}: ${calls.length} calls ${JSON.stringify(byKind)}, ${failedCalls} failed, $${cost.toFixed(4)}, ${seconds.toFixed(0)} s in Claude Code${calls.length ? ` (${(seconds / calls.length).toFixed(1)} s a call)` : ""}; generate ${records.generateSeconds} s, run ${records.runSeconds} s; ${records.tests} tests ${JSON.stringify(records.byStatus)}${models.length ? `; models ${models.join(", ")}` : ""}`);
}

out("\n== 2. Site suite per run");
for (const run of RUNS) {
    const generated = read(`${run}-generate.json`);
    if (!generated) continue;
    const s = generated.siteSuite;
    const g = s.gapTests;
    const c = s.candidateTests;
    out(`${run}: firstRun ${s.firstRun}, reused ${s.reused}, generated ${s.generated}, regenerated ${s.regenerated}, retired ${s.retired}; new types ${JSON.stringify(s.newTypes)}, gone ${JSON.stringify(s.goneTypes)}`);
    if (g) out(`  gap writer: ${g.gaps} gaps, ${g.asked} asked, ${g.saved} saved, ${g.rejected} rejected, ${g.failed} not kept, $${g.costUsd.toFixed(4)}; pool: ${JSON.stringify(g.candidates)}`);
    if (c) out(`  candidates bound on Standard: ${c.bound} bound, ${c.notBound} not bound`);
}

const manifest = (run) => read(`${run}-data/site-suite/manifest.json`);
const gapUnits = (run) => (manifest(run)?.units ?? []).filter((unit) => unit.origin === "gap-writer");
// Run 3's site suite: run3a is the with-bugs run on run 1's own data folder (the suite it reused or retired);
// run 3 started from run 2's pool alone (Emil, 2026-10-15), so it reused nothing by construction.
out("\n== 3. Run 1's gap tests on with-bugs (run3a: same data folder as runs 1 and 2)");
const written1 = gapUnits("run1-clean");
const record3a = read("run3a-with-bugs-generate.json")?.siteSuite;
if (record3a) {
    out(`run3a: reused ${record3a.reused}, generated ${record3a.generated}, retired ${record3a.retired}; page types gone ${JSON.stringify(record3a.goneTypes)}, new ${JSON.stringify(record3a.newTypes)}`);
    const gone = new Set(record3a.goneTypes);
    for (const unit of written1) out(`${gone.has(unit.type) ? "retired (its page type is gone)" : "kept"} [${unit.type}] ${unit.title}`);
}
if (written1.length === 0) out("(no run 1 gap tests)");

out("\n== 4. Tests written in run 1, run in run 3: clean's gap tests, generalised and bound on with-bugs (TFP-203)");
const records3 = read("run3-with-bugs-records.json");
const written1Titles = new Set(written1.map((unit) => unit.title));
// The candidates run 1 pooled: generalised from its gap tests, so also tests written in run 1.
const poolDir1 = join(R, "run1-clean-data/candidates");
const pool1 = new Set(existsSync(poolDir1) ? readdirSync(poolDir1).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)) : []);
const fromRun1 = (records3?.records ?? []).filter((record) => written1Titles.has(record.title) || (record.candidate && pool1.has(record.candidate)));
for (const record of fromRun1) out(`${record.status} | candidate ${record.candidate ?? "-"} | ${record.title}${failed(record) ? ` | ${record.message.slice(0, 400)}` : ""}`);
out(`${fromRun1.length} ran, ${fromRun1.filter(failed).length} failed`);
const bound3 = read("run3-with-bugs-generate.json")?.siteSuite?.candidateTests;
for (const test of bound3?.tests ?? []) if (test.outcome !== "bound") out(`candidate ${test.candidate} not bound on with-bugs | ${test.title} | ${test.outcome}`);
const gapRecords3 = (records3?.records ?? []).filter((record) => record.title.startsWith("gap test:"));
out(`every gap test in run 3 (written there or bound): ${gapRecords3.length}, ${JSON.stringify(gapRecords3.reduce((map, record) => ((map[record.status] = (map[record.status] ?? 0) + 1), map), {}))}`);

out("\n== 5. Failing attempts not kept (possible hints)");
for (const run of ["run1-clean", "run3-with-bugs"]) {
    const record = read(`${run}-data/site-suite/gap-writing.json`);
    for (const test of record?.tests ?? []) if (!test.outcome.startsWith("saved")) out(`${run} | ${test.title} | ${test.attempts} attempts | ${test.outcome.slice(0, 300)}`);
}

out("\n== 6. Failures Gate B's matching run didn't have");
for (const [run, gateB] of [["run1-clean", "clean"], ["run3-with-bugs", "with-bugs"]]) {
    const ours = read(`${run}-records.json`);
    const theirs = existsSync(join("..", "2026-10-13-tfp188", "runs", `${gateB}-standard-records.json`)) ? JSON.parse(readFileSync(join("..", "2026-10-13-tfp188", "runs", `${gateB}-standard-records.json`), "utf8")) : null;
    if (!ours || !theirs) continue;
    const before = new Set(theirs.records.filter(failed).map((record) => strip(record.title)));
    const now = ours.records.filter(failed);
    const fresh = now.filter((record) => !before.has(strip(record.title)));
    out(`${run}: ${now.length} failures, Gate B ${before.size}; not in Gate B: ${fresh.length}`);
    for (const record of fresh) out(`  + ${record.generator} | ${record.page ?? ""} | ${record.title} | ${record.message.slice(0, 300)}`);
}
