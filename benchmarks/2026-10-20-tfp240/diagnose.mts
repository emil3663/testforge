// TFP-240: why "sort options order the items" is unstable on the clean local Toolshop. One spec, the template's own
// helpers (CONTROL_HELPERS, with tfSettle, tfReadItems, tfOrderProblem), that on each sort option logs every API
// request's start and finish against the moment selectOption returns and the moment tfSettle returns, reads the
// items there (what the check reads), and reads them again 3 s later.
// Usage (from the repo root, the clean copy running): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-tfp240/diagnose.mts <site> <path> <repeats>
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { CONTROL_HELPERS } = await import(pathToFileURL(join(root, "src/lib/generate/mock/controls.ts")).href);
const { PAGE_VISIT_HELPER } = await import(pathToFileURL(join(root, "src/lib/generate/page-visits.ts")).href);
const [site, path, repeats] = process.argv.slice(2);
const code = `import { test, expect } from '@playwright/test';
test.use({ baseURL: '${site}' });
${PAGE_VISIT_HELPER}
${CONTROL_HELPERS}
test('diagnose sort on ${path}', async ({ page }) => {
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const lines: string[] = [];
  page.on('request', (request) => { if (['xhr', 'fetch'].includes(request.resourceType())) lines.push(at() + ' ms  start   ' + request.url().replace('${site}', '')); });
  page.on('requestfinished', (request) => { if (['xhr', 'fetch'].includes(request.resourceType())) lines.push(at() + ' ms  finish  ' + request.url().replace('${site}', '')); });
  await tfGoto(page, '${path}');
  lines.push(at() + ' ms  page settled');
  const select = page.locator('select').filter({ has: page.locator('option', { hasText: /price|name|a\s*-\s*z/i }) }).first();
  const options = await select.locator('option').evaluateAll((list) => list.map((option) => (option.textContent || '').trim()));
  for (let position = 0; position < options.length; position++) {
    const order = tfSortOrder(options[position]);
    if (!order) continue;
    lines.push(at() + ' ms  selectOption "' + options[position] + '"');
    await select.selectOption({ index: position });
    lines.push(at() + ' ms  selectOption returned');
    await tfSettle(page);
    const read = await tfReadItems(page);
    lines.push(at() + ' ms  tfSettle returned; read now: ' + (tfOrderProblem(read, order) ?? 'in order') + ' (' + read.slice(0, 3).map((item) => item.name + ' ' + item.price).join(', ') + ')');
    await page.waitForTimeout(3000);
    const later = await tfReadItems(page);
    lines.push(at() + ' ms  3 s later: ' + (tfOrderProblem(later, order) ?? 'in order') + ' (' + later.slice(0, 3).map((item) => item.name + ' ' + item.price).join(', ') + ')');
  }
  console.log(['---', ...lines].join(String.fromCharCode(10)));
});
`;
const dir = join(root, ".playwright-runs");
await mkdir(dir, { recursive: true });
const spec = join(dir, `tfp240-diagnose-${process.pid}.spec.ts`);
await writeFile(spec, code, "utf8");
try {
    await new Promise<void>((resolve) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/tfp240-diagnose-${process.pid}.spec.ts`, "--reporter=line", "--workers=1", "--project=chromium", `--repeat-each=${repeats}`, "--timeout=120000"], { cwd: root, stdio: "inherit", env: { ...process.env, FORCE_COLOR: "0" } });
        child.on("close", () => resolve());
    });
} finally {
    await rm(spec, { force: true });
}
