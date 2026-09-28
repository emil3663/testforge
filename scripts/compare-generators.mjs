// Phase 21 (TFP-098): run the deterministic (template) generator and the local
// model side by side against one target, on demand - there is deliberately no
// CI job (Ollama only runs on the developer's machine; see the Phase 21
// record's Amendment). Setup and usage: docs/GENERATOR_COMPARISON.md.
//
//   npm run compare:generators -- --config scripts/comparison-configs/fixture.json
//
// For each case in the config:
//   1. both generators get the same request and the same introspection data
//      (Decision 2), generated in-process through the real POST /api/generate
//      handler - TESTFORGE_OLLAMA_MODEL is set for the local call and cleared
//      for the deterministic one, exactly as the route decides at runtime;
//   2. each suite is executed through a running TestForge's POST /api/run and
//      persisted like any other run (Phase 17);
//   3. the two clean runs are diffed with GET /api/runs/diff (Phase 17);
//   4. if the case names a defect and the target is the comparison fixture,
//      both suites are run again with that defect switched on.
// Everything is written to comparisons/<timestamp>/ for the report script.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { POST: generate } = await import("../src/app/api/generate/route.ts");
const { NextRequest } = await import("next/server");

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
}

const configPath = arg("config");
if (!configPath) {
    console.error("usage: npm run compare:generators -- --config <file.json> [--server http://127.0.0.1:3100] [--model testforge-qwen7b] [--only <case,case>]");
    process.exit(2);
}
const config = JSON.parse(readFileSync(configPath, "utf8"));
const server = arg("server", config.server ?? "http://127.0.0.1:3100");
const model = arg("model", config.model ?? "testforge-qwen7b");
const only = arg("only");
const onlyNames = only ? only.split(",") : null;
const cases = config.cases.filter((c) => !onlyNames || onlyNames.includes(c.name));

const outDir = join("comparisons", new Date().toISOString().replace(/[:.]/g, "-") + "-" + (config.name ?? "run"));
mkdirSync(outDir, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function json(method, path, body) {
    const res = await fetch(server + path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    return data;
}

async function setDefect(name) {
    if (!config.fixtureControl) throw new Error("case names a defect but the config has no fixtureControl URL");
    const res = await fetch(`${config.fixtureControl}/__fixture/defect?set=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`could not set defect ${name}: ${res.status}`);
}

async function resetFixture() {
    if (config.fixtureControl) await fetch(`${config.fixtureControl}/__fixture/reset`);
}

async function generateWith(generator, testCase, contentProfile) {
    if (generator === "local") process.env.TESTFORGE_OLLAMA_MODEL = model;
    else delete process.env.TESTFORGE_OLLAMA_MODEL;
    delete process.env.OPENAI_API_KEY; // never the OpenAI path in this comparison
    const started = performance.now();
    const res = await generate(
        new NextRequest(new URL("http://localhost/api/generate"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                baseUrl: config.target,
                description: testCase.description,
                selectedPractices: testCase.practices ?? [],
                contentProfile,
            }),
        })
    );
    const body = await res.json();
    return {
        ms: Math.round(performance.now() - started),
        generatedBy: body.generatedBy ?? "template",
        fallbackReason: body.fallbackReason ?? null,
        model: body.model ?? null,
        code: body.code ?? "",
    };
}

async function runSuite(code, testCase, contentProfile) {
    const started = performance.now();
    const { runId } = await json("POST", "/api/run", {
        code,
        baseUrl: config.target,
        description: testCase.description,
        selectedPractices: testCase.practices ?? [],
        contentProfile,
        auditMode: "fast",
        // Phase 34: tests that submit forms (journeys, database round trips)
        // are skipped unless the run enables interactive tests.
        enableInteractive: testCase.enableInteractive === true,
    });
    for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const snap = await json("GET", `/api/run?runId=${runId}`);
        if (snap.result && snap.runStatus !== "running" && snap.runStatus !== "queued") {
            const report = snap.result.report ?? {};
            return {
                runId,
                ms: Math.round(performance.now() - started),
                runStatus: snap.runStatus,
                summary: report.summary ?? null,
                coverage: report.coverage ?? null,
                execution: (report.execution ?? []).map((e) => ({ title: e.title, area: e.area, status: e.status, rawMessage: (e.rawMessage ?? "").slice(0, 300) })),
            };
        }
    }
}

log(`target ${config.target} via TestForge ${server}, local model ${model}, ${cases.length} case(s) -> ${outDir}`);
await resetFixture();
log("introspecting target once, shared by both generators");
const contentProfile = await json("POST", "/api/introspect", { baseUrl: config.target, paths: config.paths });
writeFileSync(join(outDir, "content-profile.json"), JSON.stringify(contentProfile, null, 2));

const results = [];
for (const testCase of cases) {
    log(`case ${testCase.name}`);
    const entry = { case: testCase, generators: {} };
    for (const generator of ["deterministic", "local"]) {
        const gen = await generateWith(generator, testCase, contentProfile);
        writeFileSync(join(outDir, `${testCase.name}.${generator}.spec.ts`), gen.code);
        log(`  ${generator}: generated in ${gen.ms} ms (${gen.generatedBy}${gen.fallbackReason ? "/" + gen.fallbackReason : ""})`);
        const g = { generation: { ms: gen.ms, generatedBy: gen.generatedBy, fallbackReason: gen.fallbackReason, model: gen.model } };
        if (generator === "local" && gen.generatedBy !== "ollama") {
            g.skipped = `the local model did not produce a usable suite (${gen.generatedBy}/${gen.fallbackReason}); its runs would only re-test the template`;
            entry.generators[generator] = g;
            log(`  local: skipped runs - ${g.skipped}`);
            continue;
        }
        await resetFixture();
        g.clean = await runSuite(gen.code, testCase, contentProfile);
        log(`  ${generator}: clean run ${g.clean.runId} ${g.clean.summary?.passed}/${g.clean.summary?.executed} passed in ${g.clean.ms} ms`);
        if (testCase.defect) {
            await resetFixture();
            await setDefect(testCase.defect);
            g.defect = await runSuite(gen.code, testCase, contentProfile);
            await resetFixture();
            log(`  ${generator}: defect run (${testCase.defect}) ${g.defect.runId} ${g.defect.summary?.passed}/${g.defect.summary?.executed} passed`);
        }
        entry.generators[generator] = g;
    }
    const det = entry.generators.deterministic?.clean?.runId;
    const loc = entry.generators.local?.clean?.runId;
    if (det && loc) entry.diff = await json("GET", `/api/runs/diff?a=${det}&b=${loc}`);
    results.push(entry);
    writeFileSync(join(outDir, "results.json"), JSON.stringify({ config, server, model, finishedAt: null, results }, null, 2));
}

writeFileSync(join(outDir, "results.json"), JSON.stringify({ config, server, model, finishedAt: new Date().toISOString(), results }, null, 2));
log(`done -> ${join(outDir, "results.json")}`);
