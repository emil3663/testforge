// Diagnostic beside run.mts (approved by Emil 2026-09-30): does the
// reliability/database drop follow the prompt or the model? Same C8 model,
// same wordings, no page data, but Phase 33's full-generation request
// (buildGenerationMessages, local-rules guides for getBestPracticeAreas'
// areas, as the route did at 4215d82) instead of the gap-fill request.
// prompt.ts, normalize.ts, local-rules.ts and mock/areas.ts are unchanged
// since 4215d82, so this is Phase 33's request byte for byte.
// Run from the repo root:
// node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-09-30-phase33-c8/run-full.mts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const { generateLocalSuite, withLocalRules } = await import("../../src/lib/generate/local-generation.ts");
const { buildGenerationMessages } = await import("../../src/lib/generate/messages.ts");
const { getBestPracticeAreas } = await import("../../src/lib/generate/mock/areas.ts");
const { normalizeContentRules, normalizeSelectedPractices, normalizeTestAuditMode } = await import("../../src/lib/generate/normalize.ts");

const CASES: Array<[string, string, string]> = [
    ["reliability", "reliability", "Check the login page (email and password fields, Sign in button) for reliability coverage."],
    ["database", "database", "Check the contact page form (name and message fields, Send button) for database coverage."],
];
const out = "benchmarks/2026-09-30-phase33-c8";
const model = "testforge-qwen7b";
const results = [];
for (const [name, practice, description] of CASES) {
    const practices = normalizeSelectedPractices([practice]);
    const areas = getBestPracticeAreas(description, practices);
    const messages = buildGenerationMessages({ baseUrl: "http://localhost:3000", auditMode: normalizeTestAuditMode(undefined), contentRules: normalizeContentRules(undefined), contentProfile: null, description }, practices);
    const sent = JSON.stringify(withLocalRules(messages, areas));
    const request = { areas, sha256: createHash("sha256").update(sent).digest("hex").slice(0, 16), chars: sent.length };
    for (let i = 1; i <= 3; i++) {
        const started = performance.now();
        const result = await generateLocalSuite(model, messages, areas);
        const ms = Math.round(performance.now() - started);
        const code = result.ok ? result.code : (result as { code?: string }).code ?? null;
        if (code) writeFileSync(join(out, `${name}-full-${i}.spec.ts`), code);
        const row = { case: name, description, request, call: i, ms, outcome: result.ok ? "ok" : result.reason, model: result.model, gates: result.gates.map((g) => `${g.gate}: ${g.measured} -> ${g.verdict}`) };
        results.push(row);
        console.log(`${name}-full-${i} ${(ms / 1000).toFixed(1)}s ${row.outcome} areas=${areas.join(",")}`);
        writeFileSync(join(out, "results-full.json"), JSON.stringify({ model, date: new Date().toISOString(), path: "buildGenerationMessages (Phase 33's full-generation request) + generateLocalSuite, guides for getBestPracticeAreas", results }, null, 2));
    }
}
