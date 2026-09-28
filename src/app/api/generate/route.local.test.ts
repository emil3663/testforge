/**
 * Tests for POST /api/generate's local (Ollama) path.
 *
 * Phase 34 (TFP-118), Option B: with TESTFORGE_OLLAMA_MODEL set, the template
 * always generates and the local model is asked only for the selected areas
 * the template left without tests; its tests are appended in a labelled block.
 * Every gate from Phases 30-33 still applies - TFP-103 guard/timeout/fallback
 * and type check, TFP-110 unawaited assertions, TFP-106/Phase 33 local rules -
 * and a rejected local suite leaves the template suite unchanged.
 *
 * The same fake server as route.test.ts (route-test-helpers.ts) stands in for
 * Ollama's OpenAI-compatible endpoint, so the route runs unmodified.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/generate/route.local.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { chatBodies, completion, fakeBaseUrl, fakeOpenAi, installFakeServer, json, useFake } from "./route-test-helpers.ts";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");
const { OPENAI_MODEL_CANDIDATES } = await import("../../../lib/generate/models.ts");
const { SYSTEM_PROMPT } = await import("../../../lib/generate/prompt.ts");
const { localRulesFor } = await import("../../../lib/generate/local-rules.ts");
const { findTypeErrors } = await import("../../../lib/generate/validate.ts");

installFakeServer();

const LOCAL_MODEL = "testforge-qwen7b";
const CATALOG_ID = `${LOCAL_MODEL}:latest`;

function useOllama(opts: { timeoutMs?: number; baseUrl?: string } = {}) {
    process.env.TESTFORGE_OLLAMA_MODEL = LOCAL_MODEL;
    process.env.TESTFORGE_OLLAMA_BASE_URL = opts.baseUrl ?? fakeBaseUrl();
    if (opts.timeoutMs) process.env.TESTFORGE_OLLAMA_TIMEOUT_MS = String(opts.timeoutMs);
}

/** A base URL nothing is listening on: bind an ephemeral port, then release it. */
async function closedBaseUrl(): Promise<string> {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const { port } = probe.address() as AddressInfo;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    return `http://127.0.0.1:${port}/v1`;
}

function request(practices: string[], description = "Check the notes page.") {
    return new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: JSON.stringify({ baseUrl: "http://localhost:3000", description, selectedPractices: practices }),
        headers: { "content-type": "application/json" },
    });
}

// Database with no page data: the template writes only a note, so it is a gap.
const GAP = ["database"];

/** The template-only suite for the same request (model variable unset). */
async function templateFor(practices: string[]) {
    const saved = process.env.TESTFORGE_OLLAMA_MODEL;
    delete process.env.TESTFORGE_OLLAMA_MODEL;
    const body = await (await POST(request(practices))).json();
    if (saved !== undefined) process.env.TESTFORGE_OLLAMA_MODEL = saved;
    return body.code as string;
}

function localSuite(lines: string[]) {
    return [
        "import { test, expect } from '@playwright/test';",
        "test.describe('Database', () => {",
        "  test('a saved note is still shown after a reload', async ({ page }) => {",
        "    await page.goto('/notes');",
        ...lines,
        "  });",
        "});",
    ].join("\n");
}

const GOOD = localSuite(["    await expect(page.locator('body')).toBeVisible();"]);

async function expectFallback(reason: string, practices = GAP) {
    const expected = await templateFor(practices);
    const body = await (await POST(request(practices))).json();
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, reason);
    assert.equal(body.code, expected, "a rejected local suite leaves the template suite unchanged");
    assert.deepEqual(body.gapFill, { gapAreas: practices.filter((p) => p !== "reliability"), outcome: "rejected" });
    return body;
}

// --- when the local model is (not) asked -------------------------------------

test("Option B: with TESTFORGE_OLLAMA_MODEL unset the response is exactly the template-only one", async () => {
    const body = await (await POST(request(GAP))).json();
    assert.deepEqual(Object.keys(body), ["code"]);
    assert.equal(chatBodies.length, 0);
});

test("Option B: no gap area means no local call - the template suite is returned as is", async () => {
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(GOOD)));
    useOllama();
    const body = await (await POST(request(["functional"]))).json();
    assert.equal(chatBodies.length, 0, "the local model must not be called");
    assert.equal(body.generatedBy, "template");
    assert.deepEqual(body.gapFill, { gapAreas: [], outcome: "no-gaps" });
    assert.equal(body.code, await templateFor(["functional"]));
});

test("Option B: reliability is never sent to the local model, even when the template left it empty", async () => {
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(GOOD)));
    useOllama();
    const onlyReliability = await (await POST(request(["reliability"]))).json();
    assert.equal(chatBodies.length, 0);
    assert.equal(onlyReliability.generatedBy, "template");

    await POST(request(["reliability", "database"]));
    const user = chatBodies[0].messages?.find((m) => m.role === "user")?.content ?? "";
    assert.match(user, /Selected best-practice coverage: database\n/);
    assert.doesNotMatch(user, /Write tests only for these coverage areas: .*reliability/);
});

// --- a gap filled ------------------------------------------------------------

test("Option B: a gap is filled - template suite first, then the local tests in a block labelled with the model", async () => {
    fakeOpenAi(["qwen2.5-coder:7b", CATALOG_ID], (_req, res) => json(res, 200, completion("```typescript\n" + GOOD + "\n```")));
    useOllama();
    const expectedTemplate = await templateFor(GAP);
    const body = await (await POST(request(GAP))).json();

    assert.equal(body.generatedBy, "template+ollama");
    assert.equal(body.model, CATALOG_ID);
    assert.deepEqual(body.gapFill, { gapAreas: ["database"], outcome: "added" });
    // Compared as strings (not startsWith) so a failure prints the diff: this
    // failed once in 19 full-suite runs on 2026-09-28 and did not reproduce.
    assert.equal(body.code.slice(0, expectedTemplate.length), expectedTemplate, "the template suite is kept whole, first");
    const appended = body.code.slice(expectedTemplate.length);
    assert.match(appended, /test\.describe\('Local model \(testforge-qwen7b:latest\)', \(\) => \{\n    test\.describe\('Database Coverage'/);
    assert.match(appended, /a saved note is still shown after a reload/);
    assert.doesNotMatch(appended, /import |```/, "the local import and fence are dropped");
    assert.deepEqual(findTypeErrors(body.code), []);
    assert.deepEqual(
        body.gates.map((g: { gate: string; verdict: string }) => `${g.gate}: ${g.verdict}`),
        ["time budget: kept", "type check: kept", "unawaited assertions: kept", "merged suite type check: kept"]
    );
});

test("Option B: the local model is asked only for the gap areas, with only their guides", async () => {
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(GOOD)));
    useOllama();
    await POST(request(["functional", "database"]));

    const messages = chatBodies[0].messages ?? [];
    assert.equal(messages.find((m) => m.role === "system")?.content, `${SYSTEM_PROMPT}\n\n${localRulesFor(["database"])}`);
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    assert.match(user, /Selected best-practice coverage: database\n/);
    assert.match(user, /Write tests only for these coverage areas: database\. The other areas are already covered/);
});

test("Option B: a configured local model fills gaps even when an OpenAI key is set - OpenAI is not called", async () => {
    fakeOpenAi([CATALOG_ID, ...OPENAI_MODEL_CANDIDATES], (_req, res) => json(res, 200, completion(GOOD)));
    useFake();
    useOllama();
    const body = await (await POST(request(GAP))).json();
    assert.equal(body.generatedBy, "template+ollama");
    assert.equal(chatBodies.length, 1);
    assert.equal(chatBodies[0].model, CATALOG_ID);
});

// --- every Phase 30-33 gate still applies; the template survives each --------

test("Option B: Ollama not running - template kept, ollama_unreachable", async (t) => {
    t.mock.method(console, "error", () => {});
    useOllama({ baseUrl: await closedBaseUrl() });
    const started = Date.now();
    await expectFallback("ollama_unreachable");
    assert.ok(Date.now() - started < 5_000, "a refused connection must not wait out the budget");
});

test("Option B: the local model never created - template kept, ollama_model_missing, raw model not used", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi(["qwen2.5-coder:7b"], (_req, res) => json(res, 200, completion("never asked")));
    useOllama();
    await expectFallback("ollama_model_missing");
    assert.equal(chatBodies.length, 0);
});

test("Option B: a hung local model times out on its own budget - template kept, the time gate says so", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([CATALOG_ID], () => {
        /* never responds */
    });
    process.env.TESTFORGE_OPENAI_TIMEOUT_MS = "60000"; // must not apply to the local path
    useOllama({ timeoutMs: 300 });
    const started = Date.now();
    const body = await expectFallback("timeout");
    assert.ok(Date.now() - started < 5_000);
    assert.deepEqual(body.gates, [{ gate: "time budget", bar: "answer within 300 ms", measured: "no answer within 300 ms", verdict: "rejected", evidence: [] }]);
});

test("Option B: Ollama answering with an error - template kept, ollama_error", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 500, { error: { message: "model failed to load", type: "api_error" } }));
    useOllama();
    await expectFallback("ollama_error");
});

test("Option B: a completion that is only a fence - template kept, empty_completion", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion("```typescript\n```")));
    useOllama();
    await expectFallback("empty_completion");
});

test("Option B: an invented API - template kept, invalid_output, with the type error as the gate's evidence", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(localSuite(["    await expect(page.locator('main')).toBeAccessible();"]))));
    useOllama();
    const body = await expectFallback("invalid_output");
    const typeGate = body.gates.find((g: { gate: string }) => g.gate === "type check");
    assert.equal(typeGate.verdict, "rejected");
    assert.equal(typeGate.bar, "0 type errors");
    assert.equal(typeGate.measured, "1 type errors");
    assert.match(typeGate.evidence[0], /TS2339 .*toBeAccessible/);
});

test("Option B: a never-awaited web-first assertion - template kept, unawaited_assertion, with the line as evidence", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(localSuite(["    expect(page).toHaveURL('https://localhost:3000/login');"]))));
    useOllama();
    const body = await expectFallback("unawaited_assertion");
    const gate = body.gates.find((g: { gate: string }) => g.gate === "unawaited assertions");
    assert.equal(gate.verdict, "rejected");
    assert.match(gate.evidence[0], /^line 5: expect\(page\)\.toHaveURL/);
});

test("Option B: an unawaited synchronous value assertion still checks, so it is not rejected", async () => {
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(localSuite(["    const status = 200;", "    expect(status).toBe(200);"]))));
    useOllama();
    const body = await (await POST(request(GAP))).json();
    assert.equal(body.generatedBy, "template+ollama");
});

test("Option B: an invented API is still invalid_output even when an assertion is also unawaited", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([CATALOG_ID], (_req, res) =>
        json(res, 200, completion(localSuite(["    expect(page).toHaveURL('u');", "    await expect(page.locator('main')).toBeAccessible();"])))
    );
    useOllama();
    await expectFallback("invalid_output");
});

test("Option B: code that passes on its own but breaks once appended is dropped - the merged file is checked too", async (t) => {
    t.mock.method(console, "error", () => {});
    // A second import is fine at the top of its own file, not inside the wrapper.
    const withImport = `import { readFileSync } from 'node:fs';\n${localSuite(["    expect(readFileSync).toBeTruthy();"])}`;
    assert.deepEqual(findTypeErrors(withImport), [], "precondition: valid on its own");
    fakeOpenAi([CATALOG_ID], (_req, res) => json(res, 200, completion(withImport)));
    useOllama();
    const body = await expectFallback("invalid_output");
    const merged = body.gates.find((g: { gate: string }) => g.gate === "merged suite type check");
    assert.equal(merged.verdict, "rejected");
    assert.equal(body.gates.find((g: { gate: string }) => g.gate === "type check").verdict, "kept");
});

// --- the OpenAI path is untouched --------------------------------------------

test("the OpenAI path never sees the local rules", async () => {
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], (_req, res) => json(res, 200, completion("// openai")));
    useFake();
    await POST(request(["accessibility"]));
    const system = chatBodies[0].messages?.find((m) => m.role === "system")?.content;
    assert.equal(system, SYSTEM_PROMPT);
});
