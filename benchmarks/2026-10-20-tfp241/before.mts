// TFP-241: what a failing shared check's evidence was before it, measured, not read. The same three-check suite as
// shared-visits.test.ts's TFP-241 case (pass, fail, pass on one shared page), with the shared-visit helper as it was at
// the given commit, run once; prints each check's attachments as the report lists them.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-tfp241/before.mts <commit>
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { PAGE_VISIT_HELPER } = await import(pathToFileURL(join(root, "src/lib/generate/page-visits.ts")).href);
const { flattenSuites } = await import(pathToFileURL(join(root, "src/lib/report/execution.ts")).href);
const { runPlaywrightSpec } = await import(pathToFileURL(join(root, "src/test-support/playwright-cli.ts")).href);
const commit = process.argv[2];
const source = execFileSync("git", ["show", `${commit}:src/lib/generate/shared-visits.ts`], { encoding: "utf8" });
const helperSource = /export const SHARED_VISIT_HELPER = `([\s\S]*?)`;\n/.exec(source)![1];
const helper = new Function("return `" + helperSource + "`;")() as string;
const site = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>E</title></head><body><main><h1>E</h1><p id="first-check">First</p></main></body></html>`);
});
await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", () => resolve()));
const origin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
const check = (name: string, body: string) => `  test('${name}', async ({ tfShared }) => {\n    const { page } = await tfShared.visit('/e');\n${body}\n  });`;
const code = `import { test, expect } from '@playwright/test';\n\ntest.use({ baseURL: '${origin}' });\n\n${PAGE_VISIT_HELPER}\n\n${helper}\n\ntest.describe('Page /e', () => {\n  const test = tfSharedTest;\n${[
    check("1 passes", "    await expect(page.locator('#first-check')).toHaveText('First');"),
    check("2 fails", "    await expect(page.locator('#second-check-missing')).toBeVisible({ timeout: 2000 });"),
    check("3 after the failure, passes", "    await expect(page.locator('h1')).toHaveText('E');"),
].join("\n\n")}\n});\n`;
const output = join(root, ".playwright-unit-runs", `tfp241-before-${process.pid}`);
try {
    const { report } = await runPlaywrightSpec(code, "tfp241-before", ["--workers=1", `--output=${output.split("\\").join("/")}`]);
    for (const record of flattenSuites(report.suites ?? [])) console.log(`${commit} | ${record.title}: ${record.status}; evidence: ${record.artifacts.map((artifact: { artifactType: string; fileName: string }) => `${artifact.artifactType} (${artifact.fileName})`).join(", ") || "none"}`);
} finally {
    site.close();
}
