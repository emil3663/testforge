// Phase 35 TFP-137: proves the template generator's output unchanged between
// two refs, on 172 fixed inputs (scripts/template-unchanged/inputs.mjs),
// byte for byte. Gate A and every "Standard output unchanged" regression
// policy rest on this; it used to exist only on the verifier's side. Since
// TFP-258 it runs Comprehensive's generator too, so a ref from before
// Phase 35's Comprehensive runs can't be compared (exit 2, named).
//
//   npm run check:template-unchanged -- <base-ref> [<head-ref>] [--rename-map <file>]
//
// Phase 48 (TFP-278, Decision 11): with --rename-map, the base ref's output
// has the map's literal name tokens replaced first
// (scripts/template-unchanged/rename-map.json), so "identical except the
// name" is measured, not read.
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
import { applyRenameMap, CheckError, compareOutputs, formatResult, parseRenameMap } from "./template-unchanged/compare.mjs";

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
    const folder = mkdtempSync(join(tmpdir(), `mr-onion-template-${ref.name}-`));
    try {
        await extract(ref.commit, folder);
        generate(folder, outFile);
        return JSON.parse(readFileSync(outFile, "utf8"));
    } finally {
        cleanUp(folder);
    }
}

const USAGE = "usage: npm run check:template-unchanged -- <base-ref> [<head-ref>] [--rename-map <file>]";

/** The refs, and the rename map's path when --rename-map names one (Phase 48, TFP-278). */
function parseArgs(args) {
    const refs = [];
    let renameMap = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--rename-map") {
            renameMap = args[++i];
            if (!renameMap) throw new CheckError(`--rename-map needs a file; ${USAGE}`);
        } else refs.push(args[i]);
    }
    if (refs.length === 0 || refs.length > 2) throw new CheckError(USAGE);
    return { baseArg: refs[0], headArg: refs[1] ?? WORK_TREE, renameMap };
}

async function main() {
    const { baseArg, headArg, renameMap } = parseArgs(process.argv.slice(2));
    const replacements = renameMap === null ? null : parseRenameMap(readFileSync(renameMap, "utf8"));
    const base = resolveRef(baseArg);
    const head = resolveRef(headArg);
    const outDir = join(workTree, "comparisons", "template-unchanged", `${base.name}-${head.name}`);
    mkdirSync(outDir, { recursive: true });
    const baseOutputs = await outputsFor(base, join(outDir, "base.json"));
    const headOutputs = await outputsFor(head, join(outDir, "head.json"));
    // Decision 11: with a map, the base side's output has the old names replaced by the new, then the two are compared
    // byte for byte as before: only the names may differ.
    const mapped = replacements === null ? null : applyRenameMap(baseOutputs, replacements);
    const result = compareOutputs(mapped?.outputs ?? baseOutputs, headOutputs);
    console.log(formatResult(result, mapped ? `${base.name} (renamed)` : base.name, head.name));
    if (mapped) console.log(`rename map ${renameMap}: ${replacements.map(({ from, to }, index) => `"${from}" -> "${to}" ${mapped.counts[index]}x`).join("; ")}`);
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
