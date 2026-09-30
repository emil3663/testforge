// Phase 36 (TFP-126, Decisions 4-6): measure a local model configuration on
// this machine with the real local generation path, repeatably.
//
//   npm run benchmark:local -- --config C1
//   npm run benchmark:local -- --config C2 --num-ctx 12288
//   npm run benchmark:local -- --config C8 --probe-num-gpu 12-29   (record each step, then stop)
//   npm run benchmark:local -- --config C8 --num-gpu <largest that loaded>
//
// Needs Ollama, a TestForge server (default http://127.0.0.1:3100, any build;
// it only runs suites) and the comparison fixture (`npm run comparison:fixture`,
// http://127.0.0.1:4410). Close other GPU programs first.
//
// For one configuration:
//   1. records the machine (Windows, GPU, driver, VRAM, Ollama version, other
//      GPU programs) and the configuration's Modelfile;
//   2. builds each fixture case's request exactly as POST /api/generate does
//      for the local model (buildGapFillMessages + the page data), with the
//      fixture's page data inspected once and reused by every configuration;
//   3. one unscored warm-up call, then `ollama ps` and `nvidia-smi` memory;
//   4. per case, 3 measured calls through generateLocalSuite - the route's own
//      call and gates - each followed by the same messages and options on
//      Ollama's native /api/chat, which reports the timings the
//      OpenAI-compatible endpoint does not;
//   5. scores every suite (benchmark-quality.ts) and runs each one that passes
//      both gates against the fixture, clean and with the case's defect on.
// Raw results go to benchmarks/<date>/<config>/, written after every call.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { release } from "node:os";
import { join } from "node:path";

const { generateLocalSuite, withLocalRules, ollamaTimeoutMs } = await import("../src/lib/generate/local-generation.ts");
const { buildGapFillMessages } = await import("../src/lib/generate/messages.ts");
const { scoreSuite, withBaseUrl } = await import("../src/lib/generate/benchmark-quality.ts");
const { normalizeBaseUrl, normalizeContentProfile, normalizeContentRules, normalizeSelectedPractices, normalizeTestAuditMode } = await import("../src/lib/generate/normalize.ts");
const { selectJourneys } = await import("../src/lib/introspect/journeys.ts");

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
}

// Decision 5. C1 is today's model, unchanged; the rest are built from a
// Modelfile with the context N (12288, amended 2026-09-29). temperature and
// num_predict are the same everywhere, so only model, quantisation, context
// and (C8) the GPU layer count change.
const NUM_PREDICT = 4096;
const TEMPERATURE = 0.2;
const CONFIGS = {
    C1: { model: "testforge-qwen7b", base: null },
    C2: { model: "testforge-bench-c2", base: "qwen2.5-coder:7b" },
    C3: { model: "testforge-bench-c3", base: "qwen2.5-coder:7b-instruct-q3_K_M" },
    C4: { model: "testforge-bench-c4", base: "qwen2.5-coder:3b" },
    C5: { model: "testforge-bench-c5", base: "qwen3.5:4b" },
    C6: { model: "testforge-bench-c6", base: "llama3.1:latest" },
    // C7's base is chosen from C2-C6 by Decision 7; its Ollama server must run
    // with OLLAMA_FLASH_ATTENTION=1 and OLLAMA_KV_CACHE_TYPE=q8_0.
    C7: { model: "testforge-bench-c7", base: arg("base", null) },
    // C1's model and context with more layers on the GPU (added 2026-09-29):
    // C1 ran 11 of 29 layers there, 59% of the model on the CPU, with 1.6 GB
    // of VRAM unused. num_gpu is the largest value --probe-num-gpu loaded.
    C8: { model: "testforge-bench-c8", base: "qwen2.5-coder:7b", numCtx: 16384, needsNumGpu: true },
};
const CASES = ["functional", "accessibility", "seo", "performance", "database", "security", "reliability"];

const configId = arg("config");
const config = CONFIGS[configId];
if (!config) {
    console.error(`usage: npm run benchmark:local -- --config <${Object.keys(CONFIGS).join("|")}> [--num-ctx N] [--base <model> (C7)] [--calls 3] [--date YYYY-MM-DD]`);
    process.exit(2);
}
// --rerun-relative only re-runs saved suites: it must not touch the measured
// configuration's model, machine record or Modelfile.
const rerunRelative = process.argv.includes("--rerun-relative");
const numCtx = arg("num-ctx") ?? (config.numCtx ? String(config.numCtx) : undefined);
const numGpu = arg("num-gpu");
const probeNumGpu = arg("probe-num-gpu");
if (config.needsNumGpu && !numGpu && !probeNumGpu) {
    console.error(`${configId} needs --num-gpu <layers> or --probe-num-gpu <from-to>`);
    process.exit(2);
}
if (config.base === null && configId !== "C1") {
    console.error(`${configId} needs --base <model>`);
    process.exit(2);
}
if (config.base && !numCtx && !rerunRelative) {
    console.error(`${configId} needs --num-ctx N (Decision 5: set from C1's measured prompt sizes)`);
    process.exit(2);
}
const calls = Number(arg("calls", "3"));
const server = arg("server", "http://127.0.0.1:3100");
const ollamaHost = (process.env.TESTFORGE_OLLAMA_BASE_URL?.trim() || "http://localhost:11434/v1").replace(/\/v1\/?$/, "");
const date = arg("date", new Date().toISOString().slice(0, 10));
const root = join("benchmarks", date);
const outDir = join(root, configId);
mkdirSync(join(root, "modelfiles"), { recursive: true });
mkdirSync(outDir, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const fixtureConfig = JSON.parse(readFileSync("scripts/comparison-configs/fixture.json", "utf8"));
// --only <case,case> is for trying the script out; a real measurement runs all seven.
const only = arg("only")?.split(",");
const cases = CASES.filter((name) => !only || only.includes(name)).map((name) => fixtureConfig.cases.find((c) => c.name === name));

function run(cmd, args) {
    try {
        return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch (error) {
        return `(${cmd} ${args.join(" ")} failed: ${error.message.split("\n")[0]})`;
    }
}

async function json(method, path, body) {
    const res = await fetch(server + path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

const fixture = fixtureConfig.fixtureControl;
const resetFixture = () => fetch(`${fixture}/__fixture/reset`);
const setDefect = (name) => fetch(`${fixture}/__fixture/defect?set=${encodeURIComponent(name)}`);

// --- 1. machine and Modelfile -------------------------------------------------
const gpuPrograms = run("nvidia-smi", ["--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader"]);
const machine = {
    recordedAt: new Date().toISOString(),
    windows: run("cmd", ["/c", "ver"]),
    osRelease: release(),
    gpu: run("nvidia-smi", ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"]),
    gpuPrograms: gpuPrograms || "none",
    // Ollama's own runner (a model still loaded) is not "another" program.
    otherGpuPrograms: gpuPrograms.split("\n").filter((line) => line.trim() && !/ollama/i.test(line)).join("; ") || "none",
    ollama: run("ollama", ["--version"]),
    ollamaEnv: { OLLAMA_FLASH_ATTENTION: process.env.OLLAMA_FLASH_ATTENTION ?? null, OLLAMA_KV_CACHE_TYPE: process.env.OLLAMA_KV_CACHE_TYPE ?? null },
    node: process.version,
};
if (!rerunRelative) writeFileSync(join(outDir, "machine.json"), JSON.stringify(machine, null, 2));
if (machine.otherGpuPrograms !== "none") log(`WARNING: other GPU programs are running: ${machine.otherGpuPrograms}`);
if (configId === "C7") log(`C7: the Ollama server must have been started with OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 (this shell has ${JSON.stringify(machine.ollamaEnv)})`);

const modelfilePath = join(root, "modelfiles", `${configId}.Modelfile`);
const modelfile = (gpuLayers) =>
    `FROM ${config.base}\nPARAMETER num_ctx ${numCtx}\nPARAMETER num_predict ${NUM_PREDICT}\nPARAMETER temperature ${TEMPERATURE}\n${gpuLayers ? `PARAMETER num_gpu ${gpuLayers}\n` : ""}`;
if (config.base && !probeNumGpu && !rerunRelative) {
    writeFileSync(modelfilePath, modelfile(numGpu));
    log(`creating ${config.model} from ${modelfilePath}`);
    execFileSync("ollama", ["create", config.model, "-f", modelfilePath], { stdio: "inherit" });
}
// --- C8: find the largest num_gpu that loads --------------------------------------
// Each step builds the model with that many GPU layers, unloads whatever is
// loaded, and makes one real request - the largest case's prompt, so the full
// context and a real prompt evaluation are allocated - with a short output.
// Every attempt is recorded. An out-of-memory failure is a result (Decision 5
// amendment), so a failing step is recorded and the probe goes on to the next.
async function probeGpuLayers(range) {
    const [from, to] = range.split("-").map(Number);
    const biggest = cases[cases.length - 1];
    const steps = [];
    for (let layers = from; layers <= to; layers++) {
        const path = join(outDir, `probe-num-gpu-${layers}.Modelfile`);
        writeFileSync(path, modelfile(layers));
        for (const loaded of run("ollama", ["ps"]).split("\n").slice(1)) {
            const name = loaded.split(/\s+/)[0];
            if (name) run("ollama", ["stop", name]);
        }
        let created = "ok";
        try {
            execFileSync("ollama", ["create", config.model, "-f", path], { stdio: ["ignore", "pipe", "pipe"] });
        } catch (error) {
            created = String(error.stderr ?? error.message).trim().split("\n").pop();
        }
        const { areas, messages } = request(biggest);
        const result = created === "ok" ? await nativeChat(withLocalRules(messages, areas), { num_predict: 16 }) : { error: `create failed: ${created}` };
        const step = {
            numGpu: layers,
            ...result,
            ollamaPs: run("ollama", ["ps"]),
            gpuMemoryUsed: run("nvidia-smi", ["--query-gpu=memory.used,memory.total", "--format=csv,noheader"]),
        };
        steps.push(step);
        writeFileSync(join(outDir, "num-gpu-steps.json"), JSON.stringify({ base: config.base, numCtx: Number(numCtx), probeCase: biggest.name, steps }, null, 2));
        const split = /(\d+%\/\d+% CPU\/GPU|\d+% GPU|\d+% CPU)/.exec(step.ollamaPs)?.[1] ?? "not loaded";
        log(`num_gpu ${layers}: ${step.error ? `ERROR ${step.error}` : `loaded in ${step.loadMs} ms, prompt ${step.promptEvalCount} tok in ${step.promptEvalMs} ms`}; ${split}; GPU ${step.gpuMemoryUsed}`);
    }
    return steps;
}

// What Ollama will actually run, for every configuration (C1 included).
if (!rerunRelative) writeFileSync(join(outDir, "modelfile.shown.txt"), run("ollama", ["show", "--modelfile", config.model]));
const parameters = run("ollama", ["show", "--parameters", config.model]);
if (!rerunRelative) writeFileSync(join(outDir, "parameters.txt"), parameters);
const shownCtx = Number(/num_ctx\s+(\d+)/.exec(parameters)?.[1]);

// --- 2. requests ----------------------------------------------------------------
const profilePath = join(root, "content-profile.json");
if (!existsSync(profilePath)) {
    await resetFixture();
    log("inspecting the fixture once; every configuration reuses this page data");
    writeFileSync(profilePath, JSON.stringify(await json("POST", "/api/introspect", { baseUrl: fixtureConfig.target, paths: fixtureConfig.paths }), null, 2));
}
const contentProfile = normalizeContentProfile(JSON.parse(readFileSync(profilePath, "utf8")));

function request(testCase) {
    const baseUrl = normalizeBaseUrl(fixtureConfig.target);
    const areas = normalizeSelectedPractices(testCase.practices);
    const contentRules = normalizeContentRules(undefined);
    contentRules.selectedJourneyIds = selectJourneys(contentProfile?.journeys ?? [], contentRules.selectedJourneyIds).map((j) => j.id);
    const messages = buildGapFillMessages({ baseUrl: baseUrl.value, auditMode: normalizeTestAuditMode(undefined), contentRules, contentProfile, description: testCase.description }, areas);
    return { areas, messages };
}

// --- helpers ----------------------------------------------------------------------
async function nativeChat(messages, extraOptions = {}) {
    const started = performance.now();
    try {
        const res = await fetch(`${ollamaHost}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: config.model, messages, stream: false, options: { temperature: TEMPERATURE, ...extraOptions } }),
            signal: AbortSignal.timeout(ollamaTimeoutMs()),
        });
        const body = await res.json();
        const ms = Math.round(performance.now() - started);
        if (!res.ok) return { ms, error: body.error ?? `HTTP ${res.status}` };
        const ns = (v) => (typeof v === "number" ? Math.round(v / 1e6) : null);
        return {
            ms,
            loadMs: ns(body.load_duration),
            promptEvalCount: body.prompt_eval_count ?? null,
            promptEvalMs: ns(body.prompt_eval_duration),
            evalCount: body.eval_count ?? null,
            evalMs: ns(body.eval_duration),
            totalMs: ns(body.total_duration),
            doneReason: body.done_reason ?? null,
        };
    } catch (error) {
        return { ms: Math.round(performance.now() - started), error: error.name === "TimeoutError" ? "timeout" : error.message };
    }
}

async function runSuite(code, testCase, defect) {
    await resetFixture();
    if (defect) await setDefect(defect);
    try {
        const { runId } = await json("POST", "/api/run", {
            code: withBaseUrl(code, fixtureConfig.target),
            baseUrl: fixtureConfig.target,
            description: testCase.description,
            selectedPractices: testCase.practices,
            contentProfile,
            auditMode: "fast",
            enableInteractive: testCase.enableInteractive === true,
        });
        for (;;) {
            await new Promise((r) => setTimeout(r, 2000));
            const snap = await json("GET", `/api/run?runId=${runId}`);
            if (snap.result && snap.runStatus !== "running" && snap.runStatus !== "queued") {
                const report = snap.result.report;
                return {
                    runId,
                    runStatus: snap.runStatus,
                    summary: report ? { executed: report.summary.executed, passed: report.summary.passed, failed: report.summary.failed, blocked: report.summary.blocked, notRun: report.summary.notRun ?? 0 } : null,
                    tests: (report?.execution ?? []).map((e) => ({ title: e.title, status: e.status })),
                };
            }
        }
    } finally {
        await resetFixture();
    }
}

const PASS = new Set(["Passed", "Flaky"]);
/** A clean run passes when it executed something and nothing failed. */
const cleanPassed = (r) => Boolean(r?.summary && r.summary.executed > 0 && r.summary.failed === 0);
/** Detected: a test that passed clean fails with the defect on (Phase 21's rule). */
function detected(clean, defect) {
    if (!clean || !defect) return null;
    const passedClean = new Set(clean.tests.filter((t) => PASS.has(t.status)).map((t) => t.title));
    return defect.tests.some((t) => passedClean.has(t.title) && !PASS.has(t.status) && t.status !== "Not run" && t.status !== "Blocked");
}

/** One call on TestForge's path (generateLocalSuite, the route's own call and gates), scored and run. */
async function measuredCall(testCase, index) {
    const { areas, messages } = request(testCase);
    const started = performance.now();
    const result = await generateLocalSuite(config.model, messages, areas);
    const ms = Math.round(performance.now() - started);
    const code = result.ok ? result.code : result.code ?? null;
    const record = {
        case: testCase.name,
        area: areas[0],
        call: index,
        openai: { ms, outcome: result.ok ? "ok" : result.reason, promptTokens: result.usage?.promptTokens ?? null, completionTokens: result.usage?.completionTokens ?? null, gates: result.gates.map((g) => `${g.gate}: ${g.measured} -> ${g.verdict}`) },
        native: null,
        quality: code ? scoreSuite(areas[0], code) : null,
    };
    if (code) writeFileSync(join(outDir, `${testCase.name}-${index}.spec.ts`), code);
    if (record.quality?.gatesPassed) {
        record.clean = await runSuite(code, testCase, null);
        if (testCase.defect) record.defect = await runSuite(code, testCase, testCase.defect);
        record.cleanPassed = cleanPassed(record.clean);
        record.detected = detected(record.clean, record.defect);
    }
    return record;
}

// --rerun-relative: re-run, with the base URL, only the already-measured
// suites that navigate to a relative URL - the ones the missing base URL
// affected - writing the new outcomes beside results.json, never over it.
if (rerunRelative) {
    const measured = JSON.parse(readFileSync(join(outDir, "results.json"), "utf8"));
    const reruns = [];
    for (const record of measured.results.filter((r) => r.quality?.gatesPassed)) {
        const code = readFileSync(join(outDir, `${record.case}-${record.call}.spec.ts`), "utf8");
        if (!/page\.goto\(\s*['"`]\//.test(code)) continue;
        const testCase = cases.find((c) => c.name === record.case);
        const clean = await runSuite(code, testCase, null);
        const defect = testCase.defect ? await runSuite(code, testCase, testCase.defect) : undefined;
        const rerun = { case: record.case, call: record.call, before: { cleanPassed: record.cleanPassed, detected: record.detected }, clean, defect, cleanPassed: cleanPassed(clean), detected: detected(clean, defect) };
        reruns.push(rerun);
        log(`${record.case} #${record.call}: clean ${record.cleanPassed ? "pass" : "FAIL"} -> ${rerun.cleanPassed ? "pass" : "FAIL"}${testCase.defect ? `, detected ${record.detected} -> ${rerun.detected}` : ""}`);
    }
    writeFileSync(join(outDir, "rerun-with-base-url.json"), JSON.stringify({ reason: "suites run without the base URL TestForge gives them; see withBaseUrl", rerunAt: new Date().toISOString(), reruns }, null, 2));
    log(`${reruns.length} suite(s) re-run -> ${join(outDir, "rerun-with-base-url.json")}`);
    process.exit(0);
}

if (probeNumGpu) {
    const steps = await probeGpuLayers(probeNumGpu);
    const loaded = steps.filter((step) => !step.error).map((step) => step.numGpu);
    log(`probe done: loaded at ${loaded.join(", ") || "none"}; largest ${loaded.length ? Math.max(...loaded) : "none"} -> ${join(outDir, "num-gpu-steps.json")}`);
    process.exit(0);
}

// --- 3-5. warm-up, memory, measured calls ---------------------------------------
log(`${configId}: ${config.model}${config.base ? ` (FROM ${config.base}, num_ctx ${numCtx})` : ""}, num_ctx as loaded ${shownCtx || "(model default)"}, ${cases.length} cases x ${calls} calls -> ${outDir}`);
// The warm-up is not scored. It is made on the native endpoint with the model
// unloaded first, so it records the cold numbers once per configuration: load
// time and a full prompt evaluation (the measured calls reuse the prefix every
// request shares - see the call order below). It uses the last case, so the
// first measured call does not find its own prompt already cached.
run("ollama", ["stop", config.model]);
const warm = request(cases[cases.length - 1]);
const warmUp = { case: cases[cases.length - 1].name, ...(await nativeChat(withLocalRules(warm.messages, warm.areas))) };
log(`warm-up (cold, native, not scored): ${warmUp.ms} ms${warmUp.error ? ` ERROR ${warmUp.error}` : `, load ${warmUp.loadMs} ms, prompt ${warmUp.promptEvalCount} tok in ${warmUp.promptEvalMs} ms, out ${warmUp.evalCount} tok in ${warmUp.evalMs} ms`}`);
const memory = {
    ollamaPs: run("ollama", ["ps"]),
    gpuMemoryUsed: run("nvidia-smi", ["--query-gpu=memory.used,memory.total", "--format=csv,noheader"]),
};
log(`memory after warm-up:\n${memory.ollamaPs}\n  GPU: ${memory.gpuMemoryUsed}`);

const results = [];
const save = (finishedAt) =>
    writeFileSync(join(outDir, "results.json"), JSON.stringify({ config: configId, model: config.model, base: config.base, numCtx: numCtx ? Number(numCtx) : shownCtx || null, numGpu: numGpu ? Number(numGpu) : null, numPredict: NUM_PREDICT, temperature: TEMPERATURE, timeoutMs: ollamaTimeoutMs(), warmUp, memory, finishedAt, results }, null, 2));
// Call order. Ollama reuses its cached prompt when a request repeats the one
// before it: measured in the first smoke test, a native call made straight
// after the identical OpenAI-compatible call evaluated a 6202-token prompt in
// 0.3 s. So each round makes every case's TestForge-path call, then every
// case's native call. Every call then follows a *different* request - the
// shared system-prompt prefix is cached, the request itself is not - the same
// condition for both endpoints, and the steady state a real user sees.
for (let i = 1; i <= calls; i++) {
    const round = [];
    for (const testCase of cases) {
        const record = await measuredCall(testCase, i);
        round.push(record);
        results.push(record);
        save(null);
        const q = record.quality;
        log(`${testCase.name} #${i}: ${record.openai.ms} ms ${record.openai.outcome}, prompt ${record.openai.promptTokens ?? "?"} tok, out ${record.openai.completionTokens ?? "?"} tok; ` +
            (q ? `gates ${q.gatesPassed ? "pass" : `fail (${q.typeErrors} type, ${q.unawaitedAssertions} unawaited)`}, ${q.tests} tests, signal ${q.categorySignal}` : "no code") +
            (record.clean ? `; clean ${record.cleanPassed ? "pass" : "FAIL"}${record.defect ? `, defect ${record.detected ? "detected" : "missed"}` : ""}` : ""));
    }
    for (const record of round) {
        const { areas, messages } = request(cases.find((c) => c.name === record.case));
        record.native = await nativeChat(withLocalRules(messages, areas));
        save(null);
        const n = record.native;
        log(`${record.case} #${i} native: ${n.ms} ms${n.error ? ` ERROR ${n.error}` : `, prompt ${n.promptEvalCount} tok in ${n.promptEvalMs} ms, out ${n.evalCount} tok in ${n.evalMs} ms, load ${n.loadMs} ms`}`);
    }
}
save(new Date().toISOString());
log(`done -> ${join(outDir, "results.json")}; summarise with: node scripts/benchmark-summary.mjs ${outDir}`);
