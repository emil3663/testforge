import { homedir } from "os";
import { join, resolve } from "path";

/**
 * Phase 42 (TFP-190, Decision 4; folder: owner decision, 2026-10-13):
 * TestForge's local data folder, outside the repo. Site suites (and, later,
 * the candidate pool) hold one site's selectors, pages and fingerprints, so
 * they never live in the repository or in the repo-relative `runs/`.
 *
 * - `TESTFORGE_DATA_DIR` wins when set (every test sets it to a temporary
 *   folder, so no test touches the real one);
 * - Windows: `%LOCALAPPDATA%\TestForge`;
 * - macOS: `~/Library/Application Support/TestForge`;
 * - elsewhere: `$XDG_DATA_HOME/testforge`, or `~/.local/share/testforge`.
 *
 * Read on every call, not once at load, so a test can point it elsewhere.
 */
export function dataDir(env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform, home: string = homedir()): string {
    if (env.TESTFORGE_DATA_DIR?.trim()) return resolve(env.TESTFORGE_DATA_DIR.trim());
    if (platform === "win32") return join(env.LOCALAPPDATA?.trim() || join(home, "AppData", "Local"), "TestForge");
    if (platform === "darwin") return join(home, "Library", "Application Support", "TestForge");
    return join(env.XDG_DATA_HOME?.trim() || join(home, ".local", "share"), "testforge");
}
