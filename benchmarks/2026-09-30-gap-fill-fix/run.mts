// Phase 37 TFP-131: Phase 33's per-category bar on C8 after the gap-fill fix
// (b684c00) and the two new gates (a3c52fc, 9a08267). Copied from
// ../2026-09-30-phase33-c8/run.mts with only the output folder changed. Three
// consecutive generations per category through the production gap-fill
// call (buildGapFillMessages for that one area + generateLocalSuite, the
// route's own call and gates), with Phase 33's wordings and no page data,
// as Phase 33 ran. Every suite is saved for reading by hand.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { generateLocalSuite } = await import("../../src/lib/generate/local-generation.ts");
const { buildGapFillMessages } = await import("../../src/lib/generate/messages.ts");
const { normalizeContentRules, normalizeSelectedPractices, normalizeTestAuditMode } = await import("../../src/lib/generate/normalize.ts");

const LOGIN = "Check the login page (email and password fields, Sign in button) for";
const CASES: Array<[string, string, string]> = [
    ["reliability", "reliability", `${LOGIN} reliability coverage.`],
    ["performance", "performance/load", `${LOGIN} performance/load coverage.`],
    ["seo", "seo/content", `${LOGIN} seo/content coverage.`],
    ["database", "database", "Check the contact page form (name and message fields, Send button) for database coverage."],
    ["security", "security", `${LOGIN} security coverage.`],
    ["accessibility", "accessibility", "Check the login page: the email and password fields and the Sign in button work, and the page is accessible."],
    ["functional", "functional", "Check the login page: the email and password fields accept input and the Sign in button submits the form."],
];
const out = "benchmarks/2026-09-30-gap-fill-fix"; // run from the repo root:
// node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-09-30-gap-fill-fix/run.mts
mkdirSync(out, { recursive: true });
const only = process.argv[2]?.split(",");
const model = "testforge-qwen7b";
const results = [];
for (const [name, area, description] of CASES.filter(([n]) => !only || only.includes(n))) {
    const areas = normalizeSelectedPractices([area]);
    const messages = buildGapFillMessages({ baseUrl: "http://localhost:3000", auditMode: normalizeTestAuditMode(undefined), contentRules: normalizeContentRules(undefined), contentProfile: null, description }, areas);
    for (let i = 1; i <= 3; i++) {
        const started = performance.now();
        const result = await generateLocalSuite(model, messages, areas);
        const ms = Math.round(performance.now() - started);
        const code = result.ok ? result.code : (result as { code?: string }).code ?? null;
        if (code) writeFileSync(join(out, `${name}-${i}.spec.ts`), code);
        const row = { case: name, area, description, call: i, ms, outcome: result.ok ? "ok" : result.reason, model: result.model, gates: result.gates.map((g) => `${g.gate}: ${g.measured} -> ${g.verdict}`) };
        results.push(row);
        console.log(`${name}-${i} ${(ms / 1000).toFixed(1)}s ${row.outcome}`);
        writeFileSync(join(out, "results.json"), JSON.stringify({ model, date: new Date().toISOString(), path: "buildGapFillMessages(one area, no page data) + generateLocalSuite", results }, null, 2));
    }
}
