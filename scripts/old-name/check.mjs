// Phase 48 (TFP-280, Acceptance Criteria 6): no old name in living text. Lists every "testforge", in any case, in the
// repo's tracked text files, and exits 0 only when each one is allowed by an entry in scripts/old-name/allowlist.json.
// Each entry says why. An entry that allows nothing is reported too, so the list can't outlive what it was for.
//
//   npm run check:old-name
//
// An entry is { path, why } and one of:
// - nothing more: every hit in that file, or under that folder (a path ending in "/");
// - "line": a regular expression; only the hits on a line it matches;
// - "from": a regular expression; only the hits from the first line it matches to the end of the file (a changelog's
//   past entries, below the newest);
// - "except": with a folder, the files in it the entry doesn't cover (the living files among dated records).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALLOWLIST = join(ROOT, "scripts", "old-name", "allowlist.json");

const entries = JSON.parse(readFileSync(ALLOWLIST, "utf8")).allow.map((entry, index) => {
    if (typeof entry.path !== "string" || !entry.path || typeof entry.why !== "string" || !entry.why.trim()) {
        throw new Error(`allowlist entry ${index + 1} needs a "path" and a "why"`);
    }
    return { ...entry, index, line: entry.line ? new RegExp(entry.line, "i") : null, from: entry.from ? new RegExp(entry.from) : null, used: 0 };
});

// -I: text files only. -i: any case. -z: the path and line number end in NUL, so no path is quoted and no colon in a
// line can be mistaken for a separator. Tracked files only, as git sees them.
const grep = spawnSync("git", ["grep", "-n", "-z", "-I", "-i", "--no-color", "testforge"], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
if (grep.status !== 0 && grep.status !== 1) throw new Error(`git grep failed: ${grep.stderr}`);
const hits = grep.stdout.split("\n").filter(Boolean).map((row) => {
    const [path, lineNumber, ...text] = row.split("\0");
    return { path, lineNumber: Number(lineNumber), text: text.join("\0").replace(/\r$/, "") };
});

// A tracked file whose path names the old name is a hit too (line 0), allowed only by an entry for the whole file or
// folder: a line pattern can't allow a file name.
const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
for (const path of tracked.stdout.split("\0").filter((file) => /testforge/i.test(file))) hits.push({ path, lineNumber: 0, text: "(the file's own path)" });

const fromLine = new Map();
function startOf(entry, path) {
    const key = `${entry.index}\0${path}`;
    if (!fromLine.has(key)) {
        const lines = readFileSync(join(ROOT, path), "utf8").split("\n");
        const at = lines.findIndex((line) => entry.from.test(line));
        fromLine.set(key, at === -1 ? Infinity : at + 1);
    }
    return fromLine.get(key);
}

const covers = (entry, path) =>
    (entry.path.endsWith("/") ? path.startsWith(entry.path) : path === entry.path) && !(entry.except ?? []).includes(path);
const unallowed = [];
for (const hit of hits) {
    const entry = entries.find((candidate) =>
        covers(candidate, hit.path) && (hit.lineNumber === 0 ? !candidate.line && !candidate.from : !candidate.line || candidate.line.test(hit.text)) && (!candidate.from || hit.lineNumber >= startOf(candidate, hit.path))
    );
    if (entry) entry.used += 1;
    else unallowed.push(hit);
}

const unused = entries.filter((entry) => entry.used === 0);
console.log(`old-name: ${hits.length} hits in ${new Set(hits.map((hit) => hit.path)).size} files; ${hits.length - unallowed.length} allowed by ${entries.length - unused.length} of ${entries.length} entries`);
for (const hit of unallowed) console.log(`  not allowed: ${hit.path}:${hit.lineNumber}: ${hit.text.trim().slice(0, 140)}`);
for (const entry of unused) console.log(`  allows nothing: entry ${entry.index + 1} (${entry.path}${entry.line ? `, line ${entry.line}` : ""}): ${entry.why}`);
process.exit(unallowed.length === 0 && unused.length === 0 ? 0 : 1);
