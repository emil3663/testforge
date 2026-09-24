/**
 * Tests for POST /api/generate's local (Ollama) path.
 *
 * TFP-103/105 (Phase 30): the same fake server as route.test.ts
 * (route-test-helpers.ts) stands in for Ollama's OpenAI-compatible endpoint
 * through TESTFORGE_OLLAMA_BASE_URL, so the route runs unmodified. Also
 * covers the checks every local suite must pass before it is labelled model
 * output (TFP-103 type check, TFP-110 unawaited assertions) and the local-only
 * rules layer (TFP-106, Phase 33 category guides).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/generate/route.local.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
    chatBodies,
    completion,
    fakeBaseUrl,
    fakeOpenAi,
    generateRequest,
    installFakeServer,
    json,
    templateCode,
    useFake,
} from "./route-test-helpers.ts";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");
const { OPENAI_MODEL_CANDIDATES } = await import("../../../lib/generate/models.ts");
const { SYSTEM_PROMPT } = await import("../../../lib/generate/prompt.ts");
const { localRulesFor } = await import("../../../lib/generate/local-rules.ts");

installFakeServer();


// --- TFP-103/105: local Ollama path ------------------------------------------

const LOCAL_MODEL = "testforge-qwen7b";

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

test("POST /api/generate: a local model generates, fence stripped, labelled with the catalog id", async () => {
    // Ollama lists tagged ids; the configured name is untagged.
    fakeOpenAi(["qwen2.5-coder:7b", `${LOCAL_MODEL}:latest`], (_req, res) =>
        json(res, 200, completion("```typescript\nimport { test } from '@playwright/test';\n```"))
    );
    useOllama();

    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "ollama");
    assert.equal(body.model, `${LOCAL_MODEL}:latest`);
    assert.equal(body.code, "import { test } from '@playwright/test';");
    assert.equal(chatBodies[0].model, `${LOCAL_MODEL}:latest`);
});

test("POST /api/generate: a configured local model wins over an OpenAI key", async () => {
    fakeOpenAi([`${LOCAL_MODEL}:latest`, ...OPENAI_MODEL_CANDIDATES], (_req, res) =>
        json(res, 200, completion("// local"))
    );
    useFake();
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "ollama");
    assert.equal(chatBodies.length, 1);
    assert.equal(chatBodies[0].model, `${LOCAL_MODEL}:latest`);
});

test("POST /api/generate: Ollama not running falls back as ollama_unreachable", async (t) => {
    t.mock.method(console, "error", () => {});
    const expected = await templateCode();
    useOllama({ baseUrl: await closedBaseUrl() });

    const started = Date.now();
    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "ollama_unreachable");
    assert.equal(body.code, expected);
    assert.ok(Date.now() - started < 5_000, "a refused connection must not wait out the budget");
});

test("POST /api/generate: the local model never created falls back as ollama_model_missing", async (t) => {
    t.mock.method(console, "error", () => {});
    // The raw pulled model is present, the Modelfile-defined one is not.
    fakeOpenAi(["qwen2.5-coder:7b"], (_req, res) => json(res, 200, completion("never asked")));
    const expected = await templateCode();
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "ollama_model_missing");
    assert.equal(body.code, expected);
    assert.equal(chatBodies.length, 0, "must not fall through to the raw model name");
});

test("POST /api/generate: a hung local model times out within its own budget and falls back", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([`${LOCAL_MODEL}:latest`], () => {
        /* never responds */
    });
    const expected = await templateCode();
    // The OpenAI budget must not apply to the local path.
    process.env.TESTFORGE_OPENAI_TIMEOUT_MS = "60000";
    useOllama({ timeoutMs: 300 });

    const started = Date.now();
    const body = await (await POST(generateRequest())).json();
    const elapsed = Date.now() - started;

    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "timeout");
    assert.equal(body.code, expected);
    assert.ok(elapsed < 5_000, `expected a bounded wait, took ${elapsed}ms`);
});

test("POST /api/generate: Ollama answering with an error falls back as ollama_error, not unreachable", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) =>
        json(res, 500, { error: { message: "model failed to load", type: "api_error" } })
    );
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "ollama_error");
});

test("POST /api/generate: a local completion that is only a fence falls back as empty_completion", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) => json(res, 200, completion("```typescript\n```")));
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "empty_completion");
    assert.notEqual(body.code, "");
});

test("POST /api/generate: a local suite that does not type-check falls back as invalid_output", async (t) => {
    const logged = t.mock.method(console, "error", () => {});
    // What testforge-qwen7b actually produced on 2026-09-24: a matcher Playwright doesn't have.
    const invented = [
        "```typescript",
        "import { test, expect } from '@playwright/test';",
        "test('Sign in is accessible', async ({ page }) => {",
        "  await expect(page.getByRole('button', { name: 'Sign in' })).toBeAccessible();",
        "});",
        "```",
    ].join("\n");
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) => json(res, 200, completion(invented)));
    const expected = await templateCode();
    useOllama();

    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "invalid_output");
    assert.equal(body.model, `${LOCAL_MODEL}:latest`);
    assert.equal(body.code, expected);
    assert.match(String(logged.mock.calls.at(-1)?.arguments[0]), /toBeAccessible/, "the log must say what was wrong");
});

// --- TFP-106: local-only rules layer ----------------------------------------

function accessibilityRequest() {
    return new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: JSON.stringify({
            baseUrl: "http://localhost:3000",
            description: "Check the login page is accessible.",
            selectedPractices: ["accessibility"],
        }),
        headers: { "content-type": "application/json" },
    });
}

test("POST /api/generate: the local path sends the shared prompt plus the local rules", async () => {
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) => json(res, 200, completion("// local")));
    useOllama();

    await POST(accessibilityRequest());

    const system = chatBodies[0].messages?.find((m) => m.role === "system")?.content;
    assert.equal(system, `${SYSTEM_PROMPT}\n\n${localRulesFor(["accessibility"])}`);
    assert.match(system ?? "", /toHaveAccessibleName/);
});

test("POST /api/generate: the OpenAI path never sees the local rules", async () => {
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], (_req, res) => json(res, 200, completion("// openai")));
    useFake();

    await POST(accessibilityRequest());

    const system = chatBodies[0].messages?.find((m) => m.role === "system")?.content;
    assert.equal(system, SYSTEM_PROMPT);
});

test("POST /api/generate: the local path sends only the guides for the areas the template generator would cover (Phase 33)", async () => {
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) => json(res, 200, completion("// local")));
    useOllama();

    // Nothing selected: the template generator's defaults (which include
    // accessibility and reliability) decide.
    await POST(generateRequest());
    // Only reliability selected: no other guide.
    await POST(
        new NextRequest(new URL("http://localhost/api/generate"), {
            method: "POST",
            body: JSON.stringify({ baseUrl: "http://localhost:3000", description: "x", selectedPractices: ["reliability"] }),
            headers: { "content-type": "application/json" },
        })
    );

    const [inferred, reliabilityOnly] = chatBodies.map((b) => b.messages?.find((m) => m.role === "system")?.content ?? "");
    assert.match(inferred, /Example of correct accessibility tests/);
    assert.match(inferred, /Example of correct reliability tests/);
    assert.match(reliabilityOnly, /Example of correct reliability tests/);
    assert.doesNotMatch(reliabilityOnly, /Example of correct accessibility tests/);
});

// --- TFP-110: unawaited-assertion gate --------------------------------------

function localSuite(lines: string[]): string {
    return [
        "import { test, expect } from '@playwright/test';",
        "test('t', async ({ page }) => {",
        "  await page.goto('http://localhost:3000');",
        ...lines,
        "});",
    ].join("\n");
}

test("POST /api/generate: a local suite with an unawaited web-first assertion falls back as unawaited_assertion", async (t) => {
    const logged = t.mock.method(console, "error", () => {});
    // The Phase 31 security sample: compiles, but never checks anything.
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) =>
        json(res, 200, completion(localSuite(["  expect(page).toHaveURL('https://localhost:3000/login');"])))
    );
    const expected = await templateCode();
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "unawaited_assertion");
    assert.equal(body.model, `${LOCAL_MODEL}:latest`);
    assert.equal(body.code, expected);
    assert.match(String(logged.mock.calls.at(-1)?.arguments[0]), /line 4: expect\(page\)\.toHaveURL/);
});

test("POST /api/generate: an unawaited synchronous value assertion is not rejected - it still checks", async () => {
    const code = localSuite(["  const status = 200;", "  expect(status).toBe(200);", "  await expect(page).toHaveTitle('x');"]);
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) => json(res, 200, completion(code)));
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "ollama");
    assert.equal(body.code, code);
});

test("POST /api/generate: an invented API is still invalid_output even when an assertion is also unawaited", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([`${LOCAL_MODEL}:latest`], (_req, res) =>
        json(
            res,
            200,
            completion(localSuite(["  expect(page).toHaveURL('u');", "  await expect(page.locator('main')).toBeAccessible();"]))
        )
    );
    useOllama();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.fallbackReason, "invalid_output", "the type check runs first; the two failures stay distinct");
});
