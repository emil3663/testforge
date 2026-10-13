// TFP-188: with-bugs (or clean) failures and findings whose check and cause Gate A's local run
// (benchmarks/2026-10-07-phase41-local/runs) - or the run in [baseline dir] - didn't have, the page taken out, so each can be read as
// a scored bug or a labelled failure. Usage (from runs/ or runs-hosted/): node ../new-items.mjs <with-bugs|clean> [baseline dir]
import { readFileSync } from "node:fs";
const copy = process.argv[2] ?? "with-bugs";
const norm = (s) => s.replace(/^TF[A-Z]+-\d+: /, "").replace(/\/#\//g, "/").replace(/\/(product|category)\/[\w-]+/g, "/$1/:x")
    .replace(/http:\/\/localhost:\d+/g, "<host>").replace(/testforge-missing-[a-z0-9]+/g, "<missing>").replace(/_ngcontent-ng-c\d+(="")?/g, "")
    .replace(/\d+(\.\d+)?/g, "n").replace(/ expect\(received\)[\s\S]*$/, "").slice(0, 160);
const items = (dir) => ["standard", "security", "accessibility"].flatMap((run) => JSON.parse(readFileSync(`${dir}/${copy}-${run}-records.json`, "utf8")).records.flatMap((r) => [
    ...(r.status === "Failed" ? [{ kind: "failure", r, text: r.message }] : []),
    ...r.findings.map((f) => ({ kind: "finding", r, text: f })),
]).map((x) => ({ ...x, run, key: `${run} ${x.kind} ${norm(x.r.title.replace(/ (on|for|from) \/\S*/g, ""))} | ${norm(x.text.replace(/ on \/\S*/g, ""))}` })));
const before = new Set(items(process.argv[3] ?? "../../2026-10-07-phase41-local/runs").map((x) => x.key));
const seen = new Map();
for (const x of items(".")) if (!before.has(x.key)) seen.set(x.key, [...(seen.get(x.key) ?? []), x.r.page ?? x.r.title.slice(0, 40)]);
for (const [key, pages] of seen) console.log(`${pages.length}x  ${key}`);
