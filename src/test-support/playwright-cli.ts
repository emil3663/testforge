import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { JsonReport } from "../lib/report/types.ts";

/**
 * TFP-208: runs one generated spec through the Playwright CLI, as the real-browser unit tests do,
 * and returns its JSON report.
 *
 * Two of the flakes R1 (TFP-207) carried, cookie-scope.test.ts:90 and an earlier api-fields.test.ts
 * case, failed the same way: the run's report held no test record, and the run's error output had
 * been discarded, so nothing said why. Named by this helper's first run (2026-10-16): the repo
 * config's testDir is the shared .playwright-runs, and Playwright walks all of it as a run starts.
 * When another run removes a folder there mid-walk (the executor's artifacts-<id> and auth folders,
 * a gap run's output, any run's own), the walk fails - "ENOENT: no such file or directory,
 * scandir '...'" - and the run executes nothing.
 *
 * So each run here gets a folder of its own, outside .playwright-runs, holding its spec and a
 * config that is the repo's with testDir set to that folder: the walk sees only this run's files,
 * its output (test-results) stays inside it, and creating or removing it never touches another
 * run's walk. Settings are otherwise the repo config's. The config names its outputDir (TFP-212): left to the
 * imported repo config, Playwright put every run's output in the repo root's test-results, and a run clears its
 * output folder as it starts, so two test files running at once could remove each other's artifacts
 * ("ENOENT ... mkdir 'test-results\\.playwright-artifacts-2'", control-names.test.ts, 2026-10-20).
 *
 * Removing a run's folder can fail for a while on Windows (EBUSY) as Chromium lets go of a failed test's
 * video and trace, which the old shared test-results never had to wait for. It is retried and then
 * left: a leftover folder never fails a test, and each new run removes ones over an hour old.
 *
 * An env value of undefined removes that variable from the run's environment.
 *
 * A run whose report holds no test still fails at once, naming its exit code, the report's
 * top-level errors and the tail of its error output - as TFP-169's fixture diagnostics did
 * (3b44370), with no retry around it.
 */
const RUNS_DIR = join(process.cwd(), ".playwright-unit-runs");
const STALE_MS = 60 * 60 * 1000;

async function removeQuietly(dir: string) {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
}

async function removeStaleRuns() {
    const now = Date.now();
    for (const entry of await readdir(RUNS_DIR).catch(() => [] as string[])) {
        const dir = join(RUNS_DIR, entry);
        const info = await stat(dir).catch(() => null);
        if (info && now - info.mtimeMs > STALE_MS) await removeQuietly(dir);
    }
}

export async function runPlaywrightSpec(code: string, name: string, args: string[], env: Record<string, string | undefined> = {}): Promise<{ report: JsonReport; raw: string }> {
    const id = `${name}-${process.pid}-${Date.now()}`;
    await removeStaleRuns();
    const runDir = join(RUNS_DIR, id);
    const jsonFile = join(runDir, "report.json");
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, "playwright.config.ts"), "import base from '../../playwright.config';\nexport default { ...base, testDir: '.', outputDir: './test-results' };\n", "utf8");
    await writeFile(join(runDir, `${name}.spec.ts`), code, "utf8");
    const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" };
    for (const [key, value] of Object.entries(env)) if (value === undefined) delete childEnv[key];
    try {
        let stderr = "";
        const exit = await new Promise<string>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", "--config", join(runDir, "playwright.config.ts"), "--reporter=json", "--project=chromium", ...args], {
                cwd: process.cwd(),
                env: childEnv,
                stdio: ["ignore", "ignore", "pipe"],
                windowsHide: true,
            });
            child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
            child.on("error", reject);
            child.on("close", (code, signal) => resolve(signal ? `signal ${signal}` : `exit code ${code}`));
        });
        const raw = await readFile(jsonFile, "utf8").catch((error: NodeJS.ErrnoException) => {
            throw new Error(`Playwright run ${id} wrote no report (${error.code ?? error.message}); ${exit}; error output: ${stderr.slice(-1500) || "(none)"}`);
        });
        const report = JSON.parse(raw) as JsonReport;
        if ((report.suites ?? []).length === 0) {
            const errors = (report.errors ?? []).map((error) => (error.message ?? "").slice(0, 500)).join(" | ");
            throw new Error(`Playwright run ${id} ran no test; ${exit}; report errors: ${errors || "(none)"}; error output: ${stderr.slice(-1500) || "(none)"}`);
        }
        return { report, raw };
    } finally {
        await removeQuietly(runDir);
    }
}
