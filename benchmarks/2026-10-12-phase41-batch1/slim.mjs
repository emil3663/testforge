// Phase 41 batch 1: a Playwright JSON report reduced to each test's title, page, status, message and findings.
// Usage: node benchmarks/2026-10-12-phase41-batch1/slim.mjs <report.json> <out.json> <label> <site> <commit>
import { readFileSync, writeFileSync } from "node:fs";
const [file, out, label, site, commit] = process.argv.slice(2);
const report = JSON.parse(readFileSync(file, "utf8"));
const records = [];
const walk = (suite) => { for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) { const r = t.results?.[t.results.length - 1] ?? {}; const notes = (t.annotations ?? []).concat(r.annotations ?? []); records.push({ title: spec.title, status: r.status === "skipped" || t.status === "skipped" ? "Not run" : r.status === "passed" ? "Passed" : "Failed", page: notes.find((a) => a.type === "page")?.description ?? null, message: r.status && r.status !== "passed" && r.status !== "skipped" ? (r.error?.message ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0] : "", skipReason: notes.find((a) => a.type === "skip")?.description ?? "", findings: notes.filter((a) => a.type === "finding").map((a) => a.description), probe: notes.filter((a) => a.type === "probe").map((a) => a.description) }); } for (const child of suite.suites ?? []) walk(child); };
for (const suite of report.suites ?? []) walk(suite);
writeFileSync(out, JSON.stringify({ label, site, commit, startedAt: report.stats?.startTime, durationSeconds: Math.round((report.stats?.duration ?? 0) / 1000), tests: records.length, records }, null, 2));
console.log(`${label}: ${records.length} tests`);
