import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * TFP-222: every Playwright run in a folder of its own. TFP-208 found the cause of the unit tests' runs that executed
 * nothing: a config whose testDir is a shared folder makes Playwright walk all of it as a run starts, and a folder
 * another run removes mid-walk fails that run ("ENOENT: no such file or directory, scandir '...'"). TST-02 fixed it
 * for the unit tests (src/test-support/playwright-cli.ts); the app's own runs - the executor's, a gap run's, a stale
 * re-check's - still used the repo config, whose testDir is the shared .playwright-runs.
 *
 * Each run now gets a folder under its root with a config that is the repo's with testDir set to that folder, so its
 * walk sees only its own files, and making or removing another run's folder never touches it. Removing a folder can
 * fail for a while on Windows (EBUSY) as Chromium lets go of a failed test's video and trace: it is retried and then
 * left, never failing a run, and a later run removes it once it is over an hour old.
 */
export const PLAYWRIGHT_RUNS_DIR = join(process.cwd(), ".playwright-runs");
export const STALE_RUN_FOLDER_MS = 60 * 60 * 1000;

/** The folder for one run, with its config (the repo's, testDir the folder itself); `extra` adds config fields. */
export async function createRunFolder(root: string, name: string, extra = ""): Promise<{ dir: string; config: string }> {
    const dir = join(root, name);
    await mkdir(dir, { recursive: true });
    const base = relative(dir, join(process.cwd(), "playwright.config")).replace(/\\/g, "/");
    const config = join(dir, "playwright.config.ts");
    await writeFile(config, `import base from '${base}';\nexport default { ...base, testDir: '.'${extra} };\n`, "utf8");
    return { dir, config };
}

/** Removes a run's folder: retried while Windows still holds it, then left (never failing the run). */
export async function removeRunFolder(dir: string) {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
}

/** Removes the folders under root that `isStale` names (given each one's name and age), each as removeRunFolder does. */
export async function removeStaleRunFolders(root: string, isStale: (name: string, ageMs: number) => boolean) {
    const now = Date.now();
    for (const entry of await readdir(root).catch(() => [] as string[])) {
        const dir = join(root, entry);
        const info = await stat(dir).catch(() => null);
        if (info?.isDirectory() && isStale(entry, now - info.mtimeMs)) await removeRunFolder(dir);
    }
}
