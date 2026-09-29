// Phase 36 (TFP-126): summarise one or more benchmark-local-models results
// (benchmarks/<date>/<config>/results.json) into Decision 6's numbers and the
// counts Decision 7's rule compares. Prints markdown; writes nothing.
//
//   node scripts/benchmark-summary.mjs benchmarks/2026-09-29/C1 [benchmarks/2026-09-29/C2 ...]
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
    console.error("usage: node scripts/benchmark-summary.mjs <benchmarks/date/config> [...]");
    process.exit(2);
}

// Decision 5: N is the smallest of these that holds the largest prompt plus num_predict.
const CONTEXT_CHOICES = [4096, 6144, 8192];

function quantile(values, q) {
    const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
    if (v.length === 0) return null;
    const pos = (v.length - 1) * q;
    const lo = Math.floor(pos);
    return v[lo] + (v[Math.ceil(pos)] - v[lo]) * (pos - lo);
}
const s = (ms) => (ms == null ? "n/a" : `${(ms / 1000).toFixed(1)} s`);
const whole = (x) => (x == null ? "n/a" : Math.round(x));
const rate = (count, ms) => (count && ms ? count / (ms / 1000) : null);
const one = (x) => (x == null ? "n/a" : x.toFixed(1));

for (const dir of dirs) {
    const data = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
    const machine = JSON.parse(readFileSync(join(dir, "machine.json"), "utf8"));
    const r = data.results;
    const n = r.length;
    const count = (f) => r.filter(f).length;

    const wall = r.map((x) => x.openai.ms);
    const nativeWall = r.map((x) => x.native?.ms);
    const prompts = r.map((x) => x.native?.promptEvalCount ?? x.openai.promptTokens);
    const maxPrompt = Math.max(...prompts.filter((p) => typeof p === "number"));
    const n_ = CONTEXT_CHOICES.find((c) => c >= maxPrompt + data.numPredict) ?? null;
    const both = r.filter((x) => x.native?.promptEvalCount != null && x.openai.promptTokens != null);
    const promptAgree = both.filter((x) => x.native?.promptEvalCount === x.openai.promptTokens).length;
    // The two endpoints write different outputs (temperature 0.2), so wall
    // time is compared per output token, not per call.
    const perToken = r.filter((x) => x.native && !x.native.error && x.native.evalCount && x.openai.completionTokens && x.openai.outcome !== "timeout");
    const perTokenDiffs = perToken.map((x) => {
        const a = x.openai.ms / x.openai.completionTokens;
        const b = x.native.ms / x.native.evalCount;
        return (Math.abs(a - b) / a) * 100;
    });

    console.log(`## ${data.config}: ${data.model}${data.base ? ` (FROM ${data.base})` : ""}, num_ctx ${data.numCtx}, num_predict ${data.numPredict}, temperature ${data.temperature}`);
    console.log();
    console.log(`Machine: ${machine.windows} | GPU ${machine.gpu} | ${machine.ollama} | other GPU programs: ${machine.otherGpuPrograms} | finished ${data.finishedAt ?? "(incomplete)"}`);
    const w = data.warmUp;
    console.log(`Cold warm-up (native, model unloaded first, not scored): ${s(w.ms)} total; load ${s(w.loadMs)}; prompt ${w.promptEvalCount} tokens in ${s(w.promptEvalMs)} (${one(rate(w.promptEvalCount, w.promptEvalMs))} tokens per s in); output ${w.evalCount} tokens at ${one(rate(w.evalCount, w.evalMs))} per s.`);
    console.log("Memory after warm-up:");
    console.log("```");
    console.log(data.memory.ollamaPs);
    console.log(`nvidia-smi memory used, total: ${data.memory.gpuMemoryUsed}`);
    console.log("```");
    console.log();
    console.log("| Measure | Value |");
    console.log("| --- | --- |");
    console.log(`| Suites measured | ${n} |`);
    console.log(`| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | ${s(quantile(wall, 0.5))} / ${s(quantile(wall, 0.9))} |`);
    console.log(`| Wall time, native /api/chat, same messages: median / p90 | ${s(quantile(nativeWall, 0.5))} / ${s(quantile(nativeWall, 0.9))} |`);
    console.log(`| Load duration (native): median / p90 | ${s(quantile(r.map((x) => x.native?.loadMs), 0.5))} / ${s(quantile(r.map((x) => x.native?.loadMs), 0.9))} |`);
    console.log(`| Prompt tokens: median / max | ${whole(quantile(prompts, 0.5))} / ${maxPrompt} |`);
    console.log(`| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | ${s(quantile(r.map((x) => x.native?.promptEvalMs), 0.5))} / ${s(quantile(r.map((x) => x.native?.promptEvalMs), 0.9))} |`);
    console.log(`| Output tokens: median / p90 | ${whole(quantile(r.map((x) => x.native?.evalCount), 0.5))} / ${whole(quantile(r.map((x) => x.native?.evalCount), 0.9))} |`);
    console.log(`| Generation: tokens per s out, median | ${one(quantile(r.map((x) => rate(x.native?.evalCount, x.native?.evalMs)), 0.5))} |`);
    console.log(`| Output cut at num_predict (native done_reason "length") | ${count((x) => x.native?.doneReason === "length")} of ${n} |`);
    console.log(`| Timeouts at ${data.timeoutMs / 1000} s (TestForge path) | ${count((x) => x.openai.outcome === "timeout")} |`);
    console.log(`| Endpoints agree: identical prompt token count | ${promptAgree} of ${both.length} |`);
    console.log(`| Endpoints agree: wall time per output token, difference median / max (${perToken.length} pairs) | ${one(quantile(perTokenDiffs, 0.5))}% / ${one(perTokenDiffs.length ? Math.max(...perTokenDiffs) : null)}% |`);
    console.log(`| Wall time per output token: TestForge path / native, median | ${one(quantile(perToken.map((x) => x.openai.ms / x.openai.completionTokens), 0.5))} ms / ${one(quantile(perToken.map((x) => x.native.ms / x.native.evalCount), 0.5))} ms |`);
    console.log(`| Route outcome | ${Object.entries(r.reduce((acc, x) => ((acc[x.openai.outcome] = (acc[x.openai.outcome] ?? 0) + 1), acc), {})).map(([k, v]) => `${k} ${v}`).join(", ")} |`);
    console.log(`| **Both gates passed** | **${count((x) => x.quality?.gatesPassed)} of ${n}** |`);
    console.log(`| At least one test | ${count((x) => (x.quality?.tests ?? 0) > 0)} of ${n} |`);
    console.log(`| **Category signal present** | **${count((x) => x.quality?.categorySignal === true)} of ${n}** |`);
    console.log(`| Leaked example data | ${count((x) => x.quality?.leakedExampleData)} |`);
    console.log(`| Duplicate test titles | ${count((x) => (x.quality?.duplicateTitles.length ?? 0) > 0)} |`);
    console.log(`| **Clean-run passes** (of suites passing both gates) | **${count((x) => x.cleanPassed)} of ${count((x) => x.quality?.gatesPassed)}** |`);
    const withDefect = r.filter((x) => x.defect);
    console.log(`| **Defect detections** (of gate-passing suites with a defect to find) | **${count((x) => x.detected === true)} of ${withDefect.length}** |`);
    console.log(`| Context N (smallest of ${CONTEXT_CHOICES.join(", ")} holding max prompt ${maxPrompt} + num_predict ${data.numPredict}) | ${n_ ?? `none: ${maxPrompt + data.numPredict} tokens needed`} |`);
    console.log();
    console.log("| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |");
    console.log("| --- | --- | --- | --- | --- | --- | --- |");
    for (const name of [...new Set(r.map((x) => x.case))]) {
        const c = r.filter((x) => x.case === name);
        const k = (f) => c.filter(f).length;
        console.log(`| ${name} | ${s(quantile(c.map((x) => x.openai.ms), 0.5))} | ${Math.max(...c.map((x) => x.native?.promptEvalCount ?? 0))} | ${k((x) => x.quality?.gatesPassed)}/${c.length} | ${k((x) => x.quality?.categorySignal === true)}/${c.length} | ${k((x) => x.cleanPassed)}/${k((x) => x.quality?.gatesPassed)} | ${c.some((x) => x.defect) ? `${k((x) => x.detected === true)}/${k((x) => x.defect)}` : "no defect"} |`);
    }
    console.log();
}
