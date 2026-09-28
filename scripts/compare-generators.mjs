// Phase 21 (TFP-098), re-targeted at Option B in Phase 34 (TFP-120): run the
// template generator alone and the template with the local model's gap-fill
// side by side against one target, on demand - there is deliberately no CI
// job (Ollama only runs on the developer's machine; see the Phase 21 record's
// Amendment). Setup and usage: docs/GENERATOR_COMPARISON.md.
//
//   npm run compare:generators -- --config scripts/comparison-configs/fixture.json
//
// First, a gap sweep: every area alone, with and without the page data,
// through the real route with the local model pointed at a closed port - so
// the route's own gap detection decides and no model is called.
//
// Then, for each case in the config:
//   1. both sides get the same request and the same introspection data
//      (Phase 21 Decision 2), generated in-process through the real POST
//      /api/generate handler - TESTFORGE_OLLAMA_MODEL is set for gap-fill and
//      cleared for template-only, exactly as the route decides at runtime;
//   2. each suite is executed through a running TestForge's POST /api/run and
//      persisted like any other run (Phase 17), with its generation record
//      (gap-fill outcome and gate verdicts, Phase 34 Decision 8). A gap-fill
//      suite that added nothing is the template's, byte for byte, and is not
//      run again;
//   3. the two clean runs are diffed with GET /api/runs/diff (Phase 17);
//   4. if the case names a defect and the target is the comparison fixture,
//      both suites are run again with that defect switched on.
// A case can set "noContentProfile": true to generate without page data -
// the one situation in which the template still leaves areas empty.
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

const GENERATORS = ["template", "gap-fill"];
// 127.0.0.1:9 (discard) has nothing listening: the local call fails at once.
const CLOSED_PORT = "http://127.0.0.1:9/v1";

async function generateWith(generator, testCase, contentProfile, { ollamaBaseUrl } = {}) {
    if (generator === "gap-fill") process.env.TESTFORGE_OLLAMA_MODEL = model;
    else delete process.env.TESTFORGE_OLLAMA_MODEL;
    if (ollamaBaseUrl) process.env.TESTFORGE_OLLAMA_BASE_URL = ollamaBaseUrl;
    else delete process.env.TESTFORGE_OLLAMA_BASE_URL;
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
        gapFill: body.gapFill ?? null,
        gates: body.gates ?? [],
        code: body.code ?? "",
    };
}

/** What the saved run and its report record about how the suite was made. */
function generationRecord(gen) {
    if (!gen.gapFill) return undefined;
    return { generatedBy: gen.generatedBy, model: gen.model ?? undefined, fallbackReason: gen.fallbackReason ?? undefined, gapFill: gen.gapFill, gates: gen.gates };
}

async function runSuite(code, testCase, contentProfile, generation) {
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
        generation,
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
                emptyAreas: report.emptyAreas ?? [],
                execution: (report.execution ?? []).map((e) => ({ title: e.title, area: e.area, status: e.status, generator: e.generator ?? null, skipReason: e.skipReason ?? null, rawMessage: (e.rawMessage ?? "").slice(0, 300) })),
            };
        }
    }
}

log(`target ${config.target} via TestForge ${server}, local model ${model}, ${cases.length} case(s) -> ${outDir}`);
await resetFixture();
log("introspecting target once, shared by both generators");
const contentProfile = await json("POST", "/api/introspect", { baseUrl: config.target, paths: config.paths });
writeFileSync(join(outDir, "content-profile.json"), JSON.stringify(contentProfile, null, 2));

// The gap sweep: how often would gap-filling call the model on this target?
const { BEST_PRACTICE_OPTIONS } = await import("../src/lib/generate/mock/types.ts");
const { GAP_FILL_EXCLUDED_AREAS } = await import("../src/lib/generate/gap-fill.ts");
const gapSweep = [];
for (const withProfile of [true, false]) {
    for (const area of BEST_PRACTICE_OPTIONS) {
        const probe = { description: `Check the site for ${area} coverage.`, practices: [area] };
        const gen = await generateWith("gap-fill", probe, withProfile ? contentProfile : undefined, { ollamaBaseUrl: CLOSED_PORT });
        gapSweep.push({ area, withProfile, excluded: GAP_FILL_EXCLUDED_AREAS.includes(area), gapAreas: gen.gapFill?.gapAreas ?? [], notApplicableAreas: gen.gapFill?.notApplicableAreas ?? [], outcome: gen.gapFill?.outcome ?? null });
    }
}
writeFileSync(join(outDir, "gap-sweep.json"), JSON.stringify(gapSweep, null, 2));
const gapsIn = (withProfile) => gapSweep.filter((g) => g.withProfile === withProfile && g.gapAreas.length > 0).map((g) => g.area);
log(`gap sweep: with page data, gaps in [${gapsIn(true).join(", ")}]; without page data, gaps in [${gapsIn(false).join(", ")}]`);

const results = [];
for (const testCase of cases) {
    log(`case ${testCase.name}`);
    const entry = { case: testCase, generators: {} };
    const profile = testCase.noContentProfile ? undefined : contentProfile;
    let templateCode = null;
    for (const generator of GENERATORS) {
        const gen = await generateWith(generator, testCase, profile);
        writeFileSync(join(outDir, `${testCase.name}.${generator}.spec.ts`), gen.code);
        log(`  ${generator}: generated in ${gen.ms} ms (${gen.generatedBy}${gen.fallbackReason ? "/" + gen.fallbackReason : ""}${gen.gapFill ? `, gaps [${gen.gapFill.gapAreas.join(", ")}], ${gen.gapFill.outcome}` : ""})`);
        const g = { generation: { ms: gen.ms, generatedBy: gen.generatedBy, fallbackReason: gen.fallbackReason, model: gen.model, gapFill: gen.gapFill, gates: gen.gates } };
        if (generator === "template") templateCode = gen.code;
        if (generator === "gap-fill" && gen.generatedBy !== "template+ollama") {
            g.identicalToTemplate = gen.code === templateCode;
            g.skipped = gen.gapFill?.outcome === "no-gaps"
                ? `no gaps: the template covered every area in scope${gen.gapFill.notApplicableAreas.length ? ` or found it not applicable (${gen.gapFill.notApplicableAreas.join(", ")})` : ""}, so the model was not called`
                : `the local suite was rejected (${gen.generatedBy}/${gen.fallbackReason})`;
            g.skipped += g.identicalToTemplate ? "; the suite is the template's, byte for byte" : "; WARNING: the suite differs from the template's";
            entry.generators[generator] = g;
            log(`  gap-fill: runs skipped - ${g.skipped}`);
            continue;
        }
        await resetFixture();
        g.clean = await runSuite(gen.code, testCase, profile, generationRecord(gen));
        log(`  ${generator}: clean run ${g.clean.runId} ${g.clean.summary?.passed}/${g.clean.summary?.executed} passed in ${g.clean.ms} ms`);
        if (testCase.defect) {
            await resetFixture();
            await setDefect(testCase.defect);
            g.defect = await runSuite(gen.code, testCase, profile, generationRecord(gen));
            await resetFixture();
            log(`  ${generator}: defect run (${testCase.defect}) ${g.defect.runId} ${g.defect.summary?.passed}/${g.defect.summary?.executed} passed`);
        }
        entry.generators[generator] = g;
    }
    const det = entry.generators.template?.clean?.runId;
    const loc = entry.generators["gap-fill"]?.clean?.runId;
    if (det && loc) entry.diff = await json("GET", `/api/runs/diff?a=${det}&b=${loc}`);
    results.push(entry);
    writeFileSync(join(outDir, "results.json"), JSON.stringify({ mode: "option-b", config, server, model, finishedAt: null, gapSweep, results }, null, 2));
}

writeFileSync(join(outDir, "results.json"), JSON.stringify({ mode: "option-b", config, server, model, finishedAt: new Date().toISOString(), gapSweep, results }, null, 2));
log(`done -> ${join(outDir, "results.json")}`);
