// TFP-152: the accessible-name checks generated from the saved 2026-10-01
// rizonetech.com page data for "/", run live through the Playwright CLI with
// one worker. Read-only: page loads only. Prints each check's outcome.
// Usage: node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-05-tfp152-logo-link/live-checks.ts
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { buildAccessibilityElementTests } = await load("src/lib/generate/mock/actionable-elements/index.ts");
const { flattenSuites } = await load("src/lib/report/execution.ts");

const saved = JSON.parse(await readFile(join(root, "benchmarks/2026-10-01-rizonetech/content-profile.json"), "utf8"));
const profile = saved.contentProfile ?? saved;
const tests: string[] = buildAccessibilityElementTests(profile, "/");
const numbered = tests.map((code, index) => code.replace("test('", `test('TFAC-${String(index + 2).padStart(3, "0")}: `));

const dir = join(root, ".playwright-runs");
await mkdir(dir, { recursive: true });
const name = `tfp152-live-${process.pid}`;
const specFile = join(dir, `${name}.spec.ts`);
const jsonFile = join(dir, `${name}.json`);
await writeFile(specFile, `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: 'https://rizonetech.com' });\n${numbered.join("\n\n")}\n`, "utf8");
try {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
            cwd: root, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" }, stdio: "ignore", windowsHide: true,
        });
        child.on("error", reject);
        child.on("close", () => resolve());
    });
    const records = flattenSuites(JSON.parse(await readFile(jsonFile, "utf8")).suites ?? []);
    console.log(`commit ${execSync("git rev-parse --short HEAD").toString().trim()} + working tree; ${new Date().toISOString()}; ${records.length} checks`);
    const counts: Record<string, number> = {};
    for (const record of records) counts[record.status] = (counts[record.status] ?? 0) + 1;
    console.log("statuses", JSON.stringify(counts));
    for (const record of records) {
        console.log(`${record.status.padEnd(7)} ${record.title}${record.status === "Passed" ? "" : ` | ${record.rawMessage.split("\n")[0].slice(0, 300)}`}`);
    }
} finally {
    await rm(specFile, { force: true });
    await rm(jsonFile, { force: true });
}
