import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProducedBy } from "@/lib/report/produced-by-types";

/**
 * TFP-257: which TestForge this is. package.json's `version` is the one source of truth, and the commit comes from git,
 * so a saved report answers "which TestForge found this?" by itself. Server only: the report's HTML is also built in
 * the browser, so a run carries this as data (producedBy), stamped when it starts.
 *
 * A built server says what it was built from (next.config.ts sets TESTFORGE_BUILD_* at `next build`): a pull under a
 * running `next start` changes HEAD, not the code running. Otherwise it's read on each call, so a dev server stays
 * right after a pull. A copy with no package.json or no git says so (the version "unknown", the commit null) rather
 * than failing a run, and a copy without a .git of its own doesn't report the commit of a repo it sits inside.
 */
export function currentVersion(root = process.cwd()): ProducedBy {
    if (process.env.TESTFORGE_BUILD_VERSION) {
        return { version: process.env.TESTFORGE_BUILD_VERSION, commit: process.env.TESTFORGE_BUILD_COMMIT || null };
    }
    return { version: packageVersion(root), commit: gitCommit(root) };
}

function packageVersion(root: string) {
    try {
        const version: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
        return typeof version === "string" && version ? version : "unknown";
    } catch {
        return "unknown";
    }
}

function gitCommit(root: string) {
    if (!existsSync(join(root, ".git"))) return null;
    try {
        return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true }).trim() || null;
    } catch {
        return null;
    }
}
