// Phase 35 TFP-137: proves the template generator's output unchanged between
// two refs, on 166 fixed inputs (scripts/template-unchanged/inputs.mjs),
// byte for byte. Gate A and every "Standard output unchanged" regression
// policy rest on this; it used to exist only on the verifier's side.
//
//   npm run check:template-unchanged -- <base-ref> [<head-ref>]
//
// The head defaults to the working tree. Each ref's src/, scripts/ and
// package.json are extracted with `git archive` into a temporary folder that
// links the working tree's node_modules (a directory junction on Windows, so
// no admin rights), and its generator runs in its own Node process with that
// ref's own TS resolver. No browser, no network, no model. Both outputs are
// kept under comparisons/template-unchanged/<base>-<head>/ (gitignored).
//
// Exit 0: every input identical. Exit 1: some differ (each named, with its
// first differing line). Exit 2: the check could not run (named error).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CheckError, compareOutputs, formatResult } from "./template-unchanged/compare.mjs";

const workTree = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESOLVER = "scripts/register-node-test-ts-resolver.mjs";
const GENERATE = join(workTree, "scripts/template-unchanged/generate.mjs");
const WORK_TREE = "worktree";

function git(args) {
    const result = spawnSync("git", args, { cwd: workTree, encoding: "utf8" });
    if (result.status !== 0) throw new CheckError(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
    return result.stdout.trim();
}

function resolveRef(ref) {
    if (ref === WORK_TREE) return { name: WORK_TREE, commit: null };
    const commit = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return { name: git(["rev-parse", "--short", commit]), commit };
}

/** git archive <commit> src scripts package.json, unpacked by tar inside the folder (no drive letters reach tar). */
async function extract(commit, folder) {
    await new Promise((resolve, reject) => {
        const archive = spawn("git", ["archive", "--format=tar", commit, "src", "scripts", "package.json"], { cwd: workTree });
        const untar = spawn("tar", ["-xf", "-"], { cwd: folder });
        let errors = "";
        archive.stderr.on("data", (chunk) => (errors += chunk));
        untar.stderr.on("data", (chunk) => (errors += chunk));
        archive.stdout.pipe(untar.stdin);
        archive.on("error", reject);
        untar.on("error", reject);
        untar.on("close", (code) => (code === 0 ? resolve() : reject(new CheckError(`extracting ${commit} failed: ${errors.trim()}`))));
    });
    symlinkSync(join(workTree, "node_modules"), join(folder, "node_modules"), "junction");
}

function cleanUp(folder) {
    // The node_modules link first, on its own, so removing the folder can
    // never reach through it into the real node_modules.
    const link = join(folder, "node_modules");
    if (existsSync(link)) unlinkSync(link);
    rmSync(folder, { recursive: true, force: true });
}

function generate(root, outFile) {
    if (!existsSync(join(root, RESOLVER))) throw new CheckError(`${RESOLVER} is missing at this ref, so its source can't be loaded`);
    const result = spawnSync(process.execPath, ["--import", `./${RESOLVER}`, "--experimental-strip-types", "--no-warnings", GENERATE, root, workTree, outFile], {
        cwd: root,
        encoding: "utf8",
    });
    if (result.status !== 0) throw new CheckError((result.stderr || `generator exited with ${result.status}`).trim());
}

async function outputsFor(ref, outFile) {
    if (!ref.commit) {
        generate(workTree, outFile);
        return JSON.parse(readFileSync(outFile, "utf8"));
    }
    const folder = mkdtempSync(join(tmpdir(), `testforge-template-${ref.name}-`));
    try {
        await extract(ref.commit, folder);
        generate(folder, outFile);
        return JSON.parse(readFileSync(outFile, "utf8"));
    } finally {
        cleanUp(folder);
    }
}

async function main() {
    const [baseArg, headArg = WORK_TREE] = process.argv.slice(2);
    if (!baseArg) throw new CheckError("usage: npm run check:template-unchanged -- <base-ref> [<head-ref>]");
    const base = resolveRef(baseArg);
    const head = resolveRef(headArg);
    const outDir = join(workTree, "comparisons", "template-unchanged", `${base.name}-${head.name}`);
    mkdirSync(outDir, { recursive: true });
    const baseOutputs = await outputsFor(base, join(outDir, "base.json"));
    const headOutputs = await outputsFor(head, join(outDir, "head.json"));
    const result = compareOutputs(baseOutputs, headOutputs);
    console.log(formatResult(result, base.name, head.name));
    console.log(`outputs kept in ${outDir}`);
    return result.different.length === 0 ? 0 : 1;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`template-unchanged: could not run: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
    }
);
