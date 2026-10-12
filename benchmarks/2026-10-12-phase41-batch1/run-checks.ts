// Phase 41 batch 1 (TFP-182 to TFP-185): generate a suite and run only the new checks (a --grep) on a
// local Toolshop copy, with the read-only gate (TESTFORGE_INTERACTIVE=0), one worker, Chromium.
// Standard: from a committed inspection profile, or "-" to inspect the given paths first; areas comma-separated.
// Comprehensive: areas "comprehensive:<security|accessibility>", the given paths covered.
// The Playwright JSON report is written to $SCRATCH/<label>-report.json; slim.mjs reduces it for committing.
// Usage (repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <profile.json|-> <site> <grep> <areas> <label> [paths...]
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const load = (p: string) => import(pathToFileURL(join(root, p)).href);
const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");
const { findTypeErrors } = await load("src/lib/generate/validate.ts");
const { flattenSuites } = await load("src/lib/report/execution.ts");
const { inspectPages } = await load("src/lib/introspect/inspector.ts");
const { buildComprehensiveSuite } = await load("src/lib/generate/comprehensive.ts");
const { normalizeRunMode } = await load("src/lib/comprehensive/run-mode.ts");
const [profileFile, site, grep, areasArg, label, ...paths] = process.argv.slice(2);
let code: string;
if (areasArg.startsWith("comprehensive:")) {
  code = buildComprehensiveSuite(site, normalizeRunMode({ kind: "comprehensive", area: areasArg.split(":")[1] }), { covered: paths, notCovered: [], pageCap: 20 });
} else {
  let profile;
  if (profileFile === "-") { const inspection = await inspectPages(site, paths); profile = { scannedAt: new Date().toISOString(), baseUrl: site, ...inspection }; }
  else { profile = JSON.parse(await readFile(profileFile, "utf8")); profile.baseUrl = site; }
  code = mockGenerate(site, "Check the site.", areasArg.split(","), profile, normalizeContentRules({ paths: profile.pages.map((p: { path: string }) => p.path) }), normalizeTestAuditMode("fast"));
}
const errors = findTypeErrors(code);
if (errors.length) { console.log("TYPE ERRORS", errors.slice(0, 5)); process.exit(1); }
const dir = join(root, ".playwright-runs"); await mkdir(dir, { recursive: true });
const name = `scratch-${label}-${process.pid}`;
await writeFile(join(dir, `${name}.spec.ts`), code, "utf8");
const out = join(process.env.SCRATCH ?? dir, `${label}`);
await writeFile(`${out}.spec.ts`, code, "utf8");
const json = join(dir, `${name}.json`);
const t0 = Date.now();
await new Promise<void>((resolve) => { const c = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--timeout=60000", "--workers=1", "--project=chromium", "--grep", grep, `--output=.playwright-runs/${name}-artifacts`], { cwd: root, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: json, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" }, stdio: "ignore", windowsHide: true }); c.on("close", () => resolve()); });
const report = JSON.parse(await readFile(json, "utf8"));
await writeFile(`${out}-report.json`, JSON.stringify(report), "utf8");
for (const f of [`${name}.spec.ts`, `${name}.json`]) await rm(join(dir, f), { force: true });
await rm(join(dir, `${name}-artifacts`), { recursive: true, force: true });
const records = flattenSuites(report.suites ?? []);
for (const r of records) console.log(`${r.status.padEnd(8)} ${r.title.slice(0, 110)}${r.skipReason ? " | " + r.skipReason : ""}${r.findings?.length ? " | findings: " + r.findings.join(" ; ").slice(0, 600) : ""}${r.status === "Failed" ? " | " + (r.rawMessage ?? "").split("\n")[0].slice(0, 700) : ""}`);
console.log(`${label}: ${records.length} tests, ${Math.round((Date.now() - t0) / 1000)} s`);
