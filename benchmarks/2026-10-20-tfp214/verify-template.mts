// TFP-214: the template's output changes on purpose in two ways - the shared-visit pass shares more checks (and the
// helper it adds changed), and the navigation check's helper comes back by Back and checks the content. This shows
// those are the only changes. For check:template-unchanged's 166 fixed inputs, each ref's output is generated again
// with the pass off ({ sharedVisits: false }); then:
// - the outputs with the pass on match check:template-unchanged's base.json and head.json (the same generation);
// - the outputs with the pass off differ only in tfCheckNavLinks: the base's, with its tfCheckNavLinks replaced by the
//   head's, is the head's, byte for byte. So every check's own code is unchanged, and the rest of the difference is
//   the pass's.
// Usage (from the repo root, after `npm run check:template-unchanged -- <base> [<head>]`; the head is the working tree):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-tfp214/verify-template.mts <base> <comparisonDir>
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [baseRef, dir] = process.argv.slice(2);
const workTree = process.cwd();
const script = join(workTree, "benchmarks/2026-10-20-tfp214/generate-unshared.mjs");
const scratch = mkdtempSync(join(tmpdir(), "tfp214-verify-"));
type Outputs = Record<string, { shared: string; unshared: string }>;

function generate(root: string, out: string): Outputs {
    const result = spawnSync(process.execPath, ["--import", pathToFileURL(join(root, "scripts/register-node-test-ts-resolver.mjs")).href, "--experimental-strip-types", script, root, workTree, out], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`generating in ${root} failed: ${result.stderr}`);
    return JSON.parse(readFileSync(out, "utf8"));
}

const baseRoot = join(scratch, "base");
let base: Outputs;
try {
    spawnSync("git", ["worktree", "add", "--detach", baseRoot, baseRef], { cwd: workTree, encoding: "utf8" });
    symlinkSync(join(workTree, "node_modules"), join(baseRoot, "node_modules"), "junction");
    base = generate(baseRoot, join(scratch, "base.json"));
} finally {
    try { unlinkSync(join(baseRoot, "node_modules")); } catch { /* not linked */ }
    spawnSync("git", ["worktree", "remove", "--force", baseRoot], { cwd: workTree });
}
const head = generate(workTree, join(scratch, "head.json"));
rmSync(scratch, { recursive: true, force: true });

const checked = { base: JSON.parse(readFileSync(join(dir, "base.json"), "utf8")) as Record<string, string>, head: JSON.parse(readFileSync(join(dir, "head.json"), "utf8")) as Record<string, string> };
const NAV = /async function tfCheckNavLinks\([\s\S]*?\n\}\n/;
const shares = (code: string) => (code.match(/await tfShared\.visit\(/g) ?? []).length;
const changes = (code: string) => (code.match(/await tfShared\.rerun\(/g) ?? []).length;
let mismatched = 0, sameUnshared = 0, navOnly = 0, other = 0, sharedBefore = 0, sharedAfter = 0, changing = 0;
for (const key of Object.keys(checked.base)) {
    if (base[key].shared !== checked.base[key] || head[key].shared !== checked.head[key]) { mismatched++; console.log(`not the checked output: ${key}`); }
    const before = base[key].unshared;
    const after = head[key].unshared;
    const headNav = NAV.exec(after)?.[0];
    if (before === after) sameUnshared++;
    else if (headNav && NAV.test(before) && before.replace(NAV, () => headNav) === after) navOnly++;
    else { other++; console.log(`other change: ${key}`); }
    sharedBefore += shares(base[key].shared);
    sharedAfter += shares(head[key].shared);
    changing += changes(head[key].shared);
}
const total = Object.keys(checked.base).length;
console.log(`${total} inputs; ${mismatched} whose output with the pass on is not check:template-unchanged's`);
console.log(`with the pass off: ${sameUnshared} identical, ${navOnly} differ by tfCheckNavLinks alone, ${other} differ otherwise`);
console.log(`checks on a shared visit, over all inputs: ${sharedBefore} before, ${sharedAfter} after, ${changing} of them changing the page (in rerun())`);
