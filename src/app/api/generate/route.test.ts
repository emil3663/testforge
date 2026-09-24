/**
 * Tests for POST /api/generate.
 *
 * TFP-067 (Phase 24 reliability audit): an unguarded `await req.json()` on a
 * malformed body threw and Next.js turned that into a raw 500. The fix
 * applies the existing in-repo `.catch(() => ({}))` pattern (see
 * runs/route.ts, run/route.ts's DELETE handler) so a malformed body instead
 * falls through to the route's own "description is required" validation,
 * which already returns a clean 400.
 *
 * TFP-083 (Phase 28): the OpenAI call must degrade to the template generator,
 * labelled, on rejection, timeout, empty completion and an unusable catalog.
 * The real `openai` SDK is pointed at a local fake server through
 * OPENAI_BASE_URL (read when the route builds its client), so the route runs
 * unmodified - no module mocking, no network.
 *
 * TFP-103/105 (Phase 30): the local Ollama path gets the same treatment - the
 * same fake server stands in for Ollama's OpenAI-compatible endpoint through
 * TESTFORGE_OLLAMA_BASE_URL. Every test starts with all generation env vars
 * cleared, so a developer's own TESTFORGE_OLLAMA_MODEL or OPENAI_API_KEY can
 * never route a test down the wrong path.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/generate/route.test.ts
 */
import assert from "node:assert";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, beforeEach, test } from "node:test";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");
const { OPENAI_MODEL_CANDIDATES } = await import("../../../lib/generate/models.ts");
const { SYSTEM_PROMPT } = await import("../../../lib/generate/prompt.ts");
const { LOCAL_MODEL_RULES } = await import("../../../lib/generate/local-rules.ts");

test("POST /api/generate: truncated JSON body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: "{not valid json",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

test("POST /api/generate: empty body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: "",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

// --- TFP-083: OpenAI failure modes -----------------------------------------

type FakeHandler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server;
let baseUrl = "";
let handler: FakeHandler = (_req, res) => res.writeHead(500).end();
const chatBodies: Array<{ model?: string; messages?: Array<{ role: string; content: string }> }> = [];

const ENV_KEYS = [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "TESTFORGE_OPENAI_TIMEOUT_MS",
    "TESTFORGE_OLLAMA_MODEL",
    "TESTFORGE_OLLAMA_BASE_URL",
    "TESTFORGE_OLLAMA_TIMEOUT_MS",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

before(async () => {
    server = createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const k of ENV_KEYS) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
    }
});

beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
    chatBodies.length = 0;
});

function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

/** Fake OpenAI: a model catalog plus a chat handler for the completion call. */
function fakeOpenAi(models: string[], chat: FakeHandler) {
    handler = (req, res) => {
        if (req.method === "GET" && req.url?.endsWith("/models")) {
            return json(res, 200, { object: "list", data: models.map((id) => ({ id, object: "model" })) });
        }
        if (req.method === "POST" && req.url?.endsWith("/chat/completions")) {
            let raw = "";
            req.on("data", (c) => (raw += c));
            req.on("end", () => {
                chatBodies.push(JSON.parse(raw));
                chat(req, res);
            });
            return;
        }
        res.writeHead(404).end();
    };
}

function completion(content: string | null) {
    return {
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "x",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    };
}

function generateRequest() {
    return new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: JSON.stringify({ baseUrl: "http://localhost:3000", description: "check the home page" }),
        headers: { "content-type": "application/json" },
    });
}

/** What the no-key path returns for the same request: the reference template output. */
async function templateCode(): Promise<string> {
    delete process.env.OPENAI_API_KEY;
    const body = await (await POST(generateRequest())).json();
    return body.code;
}

function useFake(timeoutMs?: number) {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    process.env.OPENAI_BASE_URL = baseUrl;
    if (timeoutMs) process.env.TESTFORGE_OPENAI_TIMEOUT_MS = String(timeoutMs);
}

test("POST /api/generate: no key leaves the response shape untouched", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(body), ["code"]);
    assert.ok(body.code.length > 0);
});

test("POST /api/generate: uses the first candidate present in the live catalog and reports it", async () => {
    const [, second, third] = OPENAI_MODEL_CANDIDATES;
    // Catalog lacks the first candidate; catalog order must not matter.
    fakeOpenAi(["unrelated-model", third, second], (_req, res) =>
        json(res, 200, completion("// generated by the model"))
    );
    useFake();

    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "openai");
    assert.equal(body.model, second);
    assert.equal(body.code, "// generated by the model");
    assert.equal(chatBodies[0].model, second);
});

test("POST /api/generate: no candidate in the live catalog falls back to the template", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi(["some-retired-successor"], (_req, res) => json(res, 200, completion("never asked")));
    const expected = await templateCode();
    useFake();

    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "no_candidate_model");
    assert.equal(body.code, expected);
    assert.equal(chatBodies.length, 0, "must not call the completion endpoint without a resolved model");
});

test("POST /api/generate: a rejected OpenAI call falls back to the template, not a 500", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], (_req, res) =>
        json(res, 401, { error: { message: "Incorrect API key provided", type: "invalid_request_error" } })
    );
    const expected = await templateCode();
    useFake();

    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "openai_error");
    assert.equal(body.code, expected);
});

test("POST /api/generate: a hung OpenAI call times out within the budget and falls back", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], () => {
        /* never responds */
    });
    const expected = await templateCode();
    useFake(300);

    const started = Date.now();
    const res = await POST(generateRequest());
    const body = await res.json();
    const elapsed = Date.now() - started;

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "timeout");
    assert.equal(body.code, expected);
    assert.ok(elapsed < 5_000, `expected a bounded wait, took ${elapsed}ms`);
});

test("POST /api/generate: an empty completion falls back instead of returning 200 with empty code", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], (_req, res) => json(res, 200, completion("   ")));
    const expected = await templateCode();
    useFake();

    const res = await POST(generateRequest());
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "empty_completion");
    assert.equal(body.code, expected);
    assert.notEqual(body.code, "");
});

test("POST /api/generate: a completion with no choices falls back", async (t) => {
    t.mock.method(console, "error", () => {});
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], (_req, res) => json(res, 200, { ...completion(null), choices: [] }));
    useFake();

    const body = await (await POST(generateRequest())).json();

    assert.equal(body.generatedBy, "fallback");
    assert.equal(body.fallbackReason, "empty_completion");
});

// --- TFP-103/105: local Ollama path ------------------------------------------

const LOCAL_MODEL = "testforge-qwen7b";

function useOllama(opts: { timeoutMs?: number; baseUrl?: string } = {}) {
    process.env.TESTFORGE_OLLAMA_MODEL = LOCAL_MODEL;
    process.env.TESTFORGE_OLLAMA_BASE_URL = opts.baseUrl ?? baseUrl;
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
    assert.equal(system, `${SYSTEM_PROMPT}\n\n${LOCAL_MODEL_RULES}`);
    assert.match(system ?? "", /toHaveAccessibleName/);
});

test("POST /api/generate: the OpenAI path never sees the local rules", async () => {
    fakeOpenAi([OPENAI_MODEL_CANDIDATES[0]], (_req, res) => json(res, 200, completion("// openai")));
    useFake();

    await POST(accessibilityRequest());

    const system = chatBodies[0].messages?.find((m) => m.role === "system")?.content;
    assert.equal(system, SYSTEM_PROMPT);
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
