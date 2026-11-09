import { existsSync, renameSync } from "fs";
import { homedir } from "os";
import { isAbsolute, join, relative, resolve } from "path";
import { setting } from "@/lib/settings";

/**
 * Phase 42 (TFP-190, Decision 4; folder: owner decision, 2026-10-13):
 * the local data folder, outside the repo. Site suites (and, later,
 * the candidate pool) hold one site's selectors, pages and fingerprints, so
 * they never live in the repository or in the repo-relative `runs/`.
 *
 * - `MRONION_DATA_DIR` (or the old `TESTFORGE_DATA_DIR`) wins when set, and
 *   is never moved (every test sets it to a temporary folder, so no test
 *   touches the real one);
 * - Windows: `%LOCALAPPDATA%\MrOnion`;
 * - macOS: `~/Library/Application Support/MrOnion`;
 * - elsewhere: `$XDG_DATA_HOME/mr-onion`, or `~/.local/share/mr-onion`.
 *
 * Phase 48 (TFP-277, Decision 6): the first time a process resolves the default
 * folder, a 0.2.x folder under the old name (`TestForge`, `testforge`) is
 * renamed to the new one, once. See `movedOnce`.
 *
 * Read on every call, not once at load, so a test can point it elsewhere.
 */
export function dataDir(env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform, home: string = homedir()): string {
    const configured = setting("DATA_DIR", env)?.trim();
    if (configured) return resolve(configured);
    return movedOnce(defaultDataDirs(env, platform, home));
}

/** The default folder under its new name, and under the name 0.2.x gave it (Decision 2). */
export function defaultDataDirs(env: Record<string, string | undefined>, platform: NodeJS.Platform, home: string): { current: string; old: string } {
    const parent =
        platform === "win32" ? env.LOCALAPPDATA?.trim() || join(home, "AppData", "Local")
        : platform === "darwin" ? join(home, "Library", "Application Support")
        : env.XDG_DATA_HOME?.trim() || join(home, ".local", "share");
    const [current, old] = platform === "win32" || platform === "darwin" ? ["MrOnion", "TestForge"] : ["mr-onion", "testforge"];
    return { current: join(parent, current), old: join(parent, old) };
}

type FolderOps = { exists: (path: string) => boolean; rename: (from: string, to: string) => void; notice: (text: string) => void };
const REAL: FolderOps = { exists: existsSync, rename: renameSync, notice: (text) => console.warn(text) };

// Each pair of folders is settled once per process, on globalThis: Next bundles this module into each chunk that
// imports it, and a process that couldn't move the folder keeps using the old one until it ends.
const SETTLED = Symbol.for("mr-onion.data-dir-moves");
const settled = ((globalThis as { [SETTLED]?: Map<string, string> })[SETTLED] ??= new Map<string, string>());

/**
 * Decision 6, the one-time move, as a rename in the same parent (not a copy: two copies would drift):
 * - only the old folder: renamed to the new one, and one notice says where it went;
 * - both: the new one is used, nothing is merged, and the notice names the old one as left in place;
 * - the rename fails (a file held open, a permission error): the old folder is used for this process, the notice
 *   says why, and the next process tries again. A run never starts on an empty folder because a move failed;
 * - neither, or only the new one: the new one, with no notice.
 */
export function movedOnce(dirs: { current: string; old: string }, ops: FolderOps = REAL): string {
    const key = `${dirs.old}\0${dirs.current}`;
    const known = settled.get(key);
    // A process left on the old folder looks again each time: once another process has moved it, this one follows,
    // rather than recreating the old folder empty and splitting the data between the two.
    if (known === dirs.old && !ops.exists(dirs.old) && ops.exists(dirs.current)) {
        settled.set(key, dirs.current);
        return dirs.current;
    }
    if (known !== undefined) return known;
    const folder = settle(dirs, ops);
    settled.set(key, folder);
    return folder;
}

/**
 * A path a record wrote under the old default folder (a generation record's site suite, from before the move), as
 * the same path under the new one. Null when the folder is user-set, or the path isn't under the old default.
 */
export function underCurrentName(path: string, env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform, home: string = homedir()): string | null {
    if (setting("DATA_DIR", env)?.trim()) return null;
    const { current, old } = defaultDataDirs(env, platform, home);
    const inside = relative(old, resolve(path));
    return inside && !inside.startsWith("..") && !isAbsolute(inside) ? join(current, inside) : null;
}

function settle({ current, old }: { current: string; old: string }, ops: FolderOps): string {
    // The new folder first: if another process renames between the two looks, this one doesn't report an old folder
    // as left in place that has already gone.
    const hasCurrent = ops.exists(current);
    const hasOld = ops.exists(old);
    if (hasCurrent) {
        if (hasOld) ops.notice(`Mr Onion's data folder is ${current}. The old folder ${old} is left in place; nothing in it was moved or merged.`);
        return current;
    }
    if (!hasOld) return current;
    try {
        ops.rename(old, current);
        ops.notice(`Mr Onion's data folder moved from ${old} to ${current}.`);
        return current;
    } catch (error) {
        // Another process (a second server worker) may have moved it first.
        if (ops.exists(current) && !ops.exists(old)) return current;
        const reason = error instanceof Error ? error.message : String(error);
        ops.notice(`Mr Onion couldn't move its data folder from ${old} to ${current} (${reason}); using ${old} for now. The next start tries again.`);
        return old;
    }
}
