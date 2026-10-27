// D26: the proof that moving the local Toolshop copies into WSL changed only speed. For each copy and suite, every
// test's result in the WSL run is compared with Gate D's three W1 rounds (benchmarks/2026-10-21-gate-d/runs/W1, at
// 54c38eb; the WSL runs at 41f39ac, whose src changes since are TFP-157's capped-run fix and TFP-250's wording). The
// suites: with-bugs Gate D's own files; clean generated on the WSL start, identical to Gate D's with the ids set aside
// (README.md). A test whose result differs from every round is a difference; one that differs from only some rounds
// was already varying at Gate D. Then TFP-188's evidence (the answer key's 37 scored bugs) is
// gathered from Gate D's round 1 and from the WSL run, and the two outputs are diffed.
// Usage (from the repo root): node benchmarks/2026-10-27-d26-wsl/compare.mjs
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const here = "benchmarks/2026-10-27-d26-wsl";
const gateD = "benchmarks/2026-10-21-gate-d/runs/W1";
const COPIES = ["with-bugs", "clean"];
const KINDS = ["standard", "security", "accessibility"];
const ROUNDS = [1, 2, 3];

const read = (file) => JSON.parse(readFileSync(file, "utf8"));
// The clean copy reseeds on every start and its product ids are ULIDs made at seeding, so its suites are crawled and
// generated afresh on the WSL start and its ids set aside, as TFP-211 and TFP-240 did; with-bugs' ids are integers.
const ULID = /\b01[0-9A-HJKMNP-TV-Z]{24}\b/g;
// Titles repeat across pages, and a few on one page (the same check on two elements): keyed by title, page and order.
const keyed = (records) => {
    const seen = new Map();
    return new Map(records.map((record) => {
        const base = `${record.title} @${record.page ?? ""}`.replace(ULID, "<id>");
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return [n === 1 ? base : `${base} #${n}`, record.status];
    }));
};

let differences = 0;
for (const copy of COPIES) {
    for (const kind of KINDS) {
        const wsl = read(join(here, "runs/W1", `${copy}-${kind}-run1-records.json`));
        const before = ROUNDS.map((round) => keyed(read(join(gateD, `${copy}-${kind}-run${round}-records.json`)).records));
        const now = keyed(wsl.records);
        const keys = new Set([...now.keys(), ...before.flatMap((round) => [...round.keys()])]);
        const changed = [], varying = [];
        for (const key of keys) {
            const was = before.map((round) => round.get(key) ?? "absent");
            const is = now.get(key) ?? "absent";
            if (was.every((status) => status !== is)) changed.push(`${key}: Gate D ${[...new Set(was)].join("/")}, WSL ${is}`);
            else if (new Set(was).size > 1) varying.push(`${key}: Gate D ${was.join("/")}, WSL ${is}`);
        }
        differences += changed.length;
        console.log(`${copy} ${kind}: ${wsl.tests} tests ${JSON.stringify(wsl.byStatus)}, ${wsl.runSeconds} s, timeouts ${wsl.timeouts.length}; Gate D W1 ${before.map((_, i) => read(join(gateD, `${copy}-${kind}-run${i + 1}-records.json`)).runSeconds).join("/")} s; different from every Gate D round: ${changed.length}; varying at Gate D: ${varying.length}`);
        for (const line of changed) console.log(`  DIFFERENT ${line}`);
        for (const line of varying) console.log(`  varying   ${line}`);
    }
}

// TFP-188's evidence script reads <prefix>-<kind>-records.json from its working folder.
const evidence = (source, round) => {
    const dir = mkdtempSync(join(tmpdir(), "d26-evidence-"));
    try {
        for (const copy of COPIES) for (const kind of KINDS) copyFileSync(join(source, `${copy}-${kind}-run${round}-records.json`), join(dir, `${copy}-${kind}-records.json`));
        return execFileSync(process.execPath, [resolve("benchmarks/2026-10-13-tfp188/evidence.mjs"), "with-bugs", "clean"], { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};
// Per bug ("== <bug>: <n> item(s)" and its items), with the random route ids a not-found check makes normalised. Gate
// D's own rounds differ item by item (with-bugs gives card titles a different text-align on each load: bug 4), so an
// item counts as changed only if it is in no Gate D round (new) or in every round but missing now (lost). A bug's
// verdict can move only if it has evidence in every round and none now, or none in any round and some now.
const byBug = (text) => {
    const bugs = new Map();
    let current = "before the first bug";
    for (const raw of text.split("\n")) {
        const line = raw.replace(/testforge-missing-[a-z0-9]+/g, "testforge-missing-<id>").replace(ULID, "<id>").trim();
        const header = /^== (\S+?):/.exec(line);
        if (header) current = header[1];
        if (!bugs.has(current)) bugs.set(current, new Set());
        if (line && !header) bugs.get(current).add(line);
    }
    return bugs;
};
const rounds = ROUNDS.map((round) => byBug(evidence(gateD, round)));
const now = byBug(evidence(join(here, "runs/W1"), 1));
// A bug whose items already differed between Gate D's rounds (bug 4: which card titles with-bugs misaligns changes on
// every load) is shown, but its new items aren't counted as changes: only its verdict can be.
let itemChanges = 0, verdictChanges = 0;
console.log("\nTFP-188 evidence, per answer-key bug (items: WSL, then Gate D's three rounds):");
for (const bug of new Set([...now.keys(), ...rounds.flatMap((round) => [...round.keys()])])) {
    const items = now.get(bug) ?? new Set();
    const before = rounds.map((round) => round.get(bug) ?? new Set());
    const isNew = [...items].filter((item) => before.every((round) => !round.has(item)));
    const lost = [...before[0]].filter((item) => before.every((round) => round.has(item)) && !items.has(item));
    const verdict = (before.every((round) => round.size > 0) && items.size === 0) || (before.every((round) => round.size === 0) && items.size > 0);
    const varied = new Set(before.map((round) => [...round].sort().join("\n"))).size > 1;
    if (!varied) itemChanges += isNew.length + lost.length;
    if (verdict) verdictChanges++;
    console.log(`  ${bug}: ${items.size} | ${before.map((round) => round.size).join(" ")}${varied ? " (varied at Gate D)" : ""}${verdict ? "  VERDICT CHANGED" : ""}`);
    for (const item of lost) console.log(`    lost ${item.slice(0, 240)}`);
    for (const item of isNew) console.log(`    new  ${item.slice(0, 240)}`);
}
console.log(`\n${differences === 0 && itemChanges === 0 && verdictChanges === 0 ? "SAME" : "DIFFERENT"}: ${differences} test result(s) unlike every Gate D round; ${itemChanges} evidence item(s), on bugs steady at Gate D, in no Gate D round or lost from all three; ${verdictChanges} bug verdict(s) changed`);
