// TFP-209 (owner ruling, 2026-11-02): the one real gap-writer call. Generation goes through POST /api/generate on
// the local with-bugs Toolshop, gap limit 1, so TestForge's own call path builds the arguments, --safe-mode among
// them. Claude Code is the real one behind TFP-197's claude-logger.mjs, which adds --debug-file to the program it
// runs and keeps each call's arguments, prompt and reply. The gap test is run by the writer's gate; the suite isn't.
//
// Usage (from the repo root; the copy must be running):
//   TESTFORGE_DATA_DIR=<folder outside the repo> node --import ./scripts/register-node-test-ts-resolver.mjs \
//     --experimental-strip-types benchmarks/2026-11-02-tfp209-safe-mode/run.mts <outDir> <path>
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const [outDirArg, path] = process.argv.slice(2);
const dataDir = process.env.TESTFORGE_DATA_DIR?.trim();
if (!dataDir || !isAbsolute(dataDir) || !relative(root, resolve(dataDir)).startsWith("..")) throw new Error("TESTFORGE_DATA_DIR must be an absolute folder outside the repo");
if (!outDirArg || !path?.startsWith("/")) throw new Error("usage: <outDir> <path>");
const outDir = resolve(outDirArg);
await mkdir(outDir, { recursive: true });
const callLog = join(outDir, "claude-calls.jsonl");
if (existsSync(callLog)) throw new Error("this run's call log exists: the ruling allows one run");

delete process.env.OPENAI_API_KEY;
delete process.env.TESTFORGE_OLLAMA_MODEL;
process.env.TESTFORGE_GAP_LIMIT = "1";
process.env.TFP197_CLAUDE_LOG = callLog;
const exe = execFileSync("where", ["claude"], { encoding: "utf8" }).split(/\r?\n/).find((line) => /claude\.exe$/i.test(line.trim()))?.trim();
if (!exe) throw new Error("claude.exe not found on PATH");
process.env.TFP197_CLAUDE_EXE = JSON.stringify([exe, "--debug-file", join(outDir, "claude-debug.log")]);
process.env.TESTFORGE_CLAUDE_COMMAND = JSON.stringify([process.execPath, join(root, "benchmarks/2026-10-15-tfp197-gap-writer/claude-logger.mjs")]);

const load = (file: string) => import(pathToFileURL(join(root, file)).href);
const settingsRoute = await load("src/app/api/site-settings/route.ts");
const generateRoute = await load("src/app/api/generate/route.ts");
const { NextRequest } = await import("next/server");
const post = (url: string, body: unknown) => new NextRequest(new URL(url), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

const origin = "http://localhost:4200";
const settings = await settingsRoute.POST(post("http://localhost/api/site-settings", { baseUrl: origin, gapWriter: "claude-code" }));
if (settings.status !== 200) throw new Error(`site settings: ${settings.status} ${await settings.text()}`);

const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];

const started = Date.now();
const response = await generateRoute.POST(post("http://localhost/api/generate", { baseUrl: origin, description: "Check the site.", selectedPractices: AREAS, contentRules: { paths: [path] }, auditMode: "fast" }));
const seconds = Math.round((Date.now() - started) / 1000);
if (response.status !== 200) throw new Error(`generate: ${response.status} ${await response.text()}`);
const { code, ...answer } = (await response.json()) as { code: string; siteSuite?: { store?: string } };
await writeFile(join(outDir, "suite.spec.ts"), code, "utf8");
await writeFile(join(outDir, "generate.json"), JSON.stringify(answer, null, 2), "utf8");
const gapWriting = answer.siteSuite?.store ? join(answer.siteSuite.store, "gap-writing.json") : "";
if (gapWriting && existsSync(gapWriting)) await writeFile(join(outDir, "gap-writing.json"), readFileSync(gapWriting));
const calls = existsSync(callLog) ? readFileSync(callLog, "utf8").trim().split("\n").filter(Boolean).length : 0;
console.log(`generate ${seconds} s; ${calls} claude call(s); outputs in ${outDir}`);
