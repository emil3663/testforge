// Scratch: what a Standard run on the comparison fixture sends, by method.
// Usage: node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> [interactive]
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");
const { inspectPages } = await load("src/lib/introspect/inspector.ts");
const { flattenSuites } = await load("src/lib/report/execution.ts");

const interactive = process.argv[2] === "interactive";
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];

async function freePort() {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return port;
}

const fixturePort = await freePort();
const fixture = spawn(process.execPath, ["scripts/comparison-fixture.mjs", "--port", String(fixturePort)], { cwd: root, stdio: "ignore", windowsHide: true });
for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${fixturePort}/__fixture/reset`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
}

const recorded: { method: string; path: string; bodyBytes: number }[] = [];
const proxy = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
        const body = Buffer.concat(chunks);
        recorded.push({ method: req.method ?? "", path: req.url ?? "", bodyBytes: body.length });
        const upstream = httpRequest({ host: "127.0.0.1", port: fixturePort, method: req.method, path: req.url, headers: req.headers }, (up) => {
            res.writeHead(up.statusCode ?? 502, up.headers);
            up.pipe(res);
        });
        upstream.on("error", () => res.writeHead(502).end());
        upstream.end(body);
    });
});
await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;

try {
    const inspection = await inspectPages(origin, ["/", "/login", "/notes"]);
    const profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...inspection };
    const rules = normalizeContentRules({ selectedJourneyIds: (inspection.journeys ?? []).map((j: { id: string }) => j.id) });
    const template = mockGenerate(origin, "Check the site.", AREAS, profile, rules, normalizeTestAuditMode("fast"));
    // MEASURE_MODEL_BLOCK=1: the same local-model block standard-gates.test.ts appends.
    const { mergeLocalSuite } = await load("src/lib/generate/gap-fill.ts");
    const code = process.env.MEASURE_MODEL_BLOCK ? mergeLocalSuite(template, "test.describe('Functional', () => {\n  test('the notes page loads', async ({ page }) => { await page.goto('/notes'); await expect(page.locator('h1')).toBeVisible(); });\n});", "testforge-qwen7b:latest", ["functional"]) : template;
    console.log(`model block: ${process.env.MEASURE_MODEL_BLOCK ? "yes" : "no"}; commit ${process.env.MEASURE_COMMIT ?? "?"}`);
    recorded.length = 0;

    const dir = join(root, ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `measure-standard-${process.pid}`;
    await writeFile(join(dir, `${name}.spec.ts`), code, "utf8");
    if (process.env.MEASURE_SPEC_COPY) await writeFile(process.env.MEASURE_SPEC_COPY, code, "utf8");
    const jsonFile = join(dir, `${name}.json`);
    const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" };
    delete env.TESTFORGE_INTERACTIVE;
    if (interactive) env.TESTFORGE_INTERACTIVE = "1";
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium"], { cwd: root, env, stdio: "ignore", windowsHide: true });
        child.on("error", reject);
        child.on("close", () => resolve());
    });
    const json = JSON.parse(await readFile(jsonFile, "utf8"));
    await rm(join(dir, `${name}.spec.ts`), { force: true });
    await rm(jsonFile, { force: true });
    const records = flattenSuites(json.suites ?? []);

    console.log(`interactive=${interactive ? "1" : "unset"}; run took ${Math.round((Date.now() - started) / 1000)} s; ${records.length} tests`);
    const byStatus: Record<string, number> = {};
    for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    console.log("statuses", JSON.stringify(byStatus));
    const { buildSummary } = await load("src/lib/report/summary.ts");
    const gates: Record<string, number> = {};
    for (const r of records) gates[r.gate ?? "none"] = (gates[r.gate ?? "none"] ?? 0) + 1;
    console.log("gates", JSON.stringify(gates), "notRunByGate", JSON.stringify(buildSummary(records, [], 0, interactive).notRunByGate));
    const methods: Record<string, number> = {};
    for (const r of recorded) methods[r.method] = (methods[r.method] ?? 0) + 1;
    console.log("methods", JSON.stringify(methods));
    for (const r of recorded.filter((r) => r.method !== "GET" || r.bodyBytes > 0)) console.log("  NON-GET", r.method, r.path, r.bodyBytes);
    if (process.env.MEASURE_VERBOSE) for (const r of records.filter((r) => r.status === "Not run")) console.log("  NOT RUN", r.title, "|", r.skipReason);
    for (const r of records.filter((r) => r.status === "Failed" || r.status === "Blocked")) console.log("  ", r.status, r.title, "|", r.rawMessage.slice(0, 160).replace(/\s+/g, " "));
} finally {
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    fixture.kill();
}
