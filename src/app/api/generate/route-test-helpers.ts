/**
 * Shared test support for POST /api/generate's test files (route.test.ts,
 * route.local.test.ts): a fake OpenAI-compatible server the real `openai` SDK
 * is pointed at, so the route runs unmodified - no module mocking, no network.
 *
 * Not a test file itself (it is not listed in package.json's test:unit).
 * Each test file calls installFakeServer() once at the top level.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, beforeEach } from "node:test";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");

export type FakeHandler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server;
let baseUrl = "";
let handler: FakeHandler = (_req, res) => res.writeHead(500).end();

/** Every chat-completion request body the fake received in the current test. */
export const chatBodies: Array<{ model?: string; messages?: Array<{ role: string; content: string }> }> = [];

const ENV_KEYS = [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "TESTFORGE_OPENAI_TIMEOUT_MS",
    "TESTFORGE_OLLAMA_MODEL",
    "TESTFORGE_OLLAMA_BASE_URL",
    "TESTFORGE_OLLAMA_TIMEOUT_MS",
] as const;

/**
 * Starts the fake server for the calling test file and resets state around
 * every test. Every test starts with all generation env vars cleared, so a
 * developer's own TESTFORGE_OLLAMA_MODEL or OPENAI_API_KEY can never route a
 * test down the wrong path; the originals are restored when the file ends.
 */
export function installFakeServer() {
    const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

    before(async () => {
        // Connection: close on every response, so the SDK never reuses a pooled
        // socket. Under full-suite load a reused keep-alive socket could hit the
        // server's 5 s idle close mid-request, and the route then reported
        // "ollama_unreachable" for a server that was up (seen twice in ~25 runs,
        // always on the first request after a gap between tests).
        server = createServer((req, res) => {
            res.setHeader("connection", "close");
            handler(req, res);
        });
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
}

/** The fake server's OpenAI-style base URL (valid once the file's before() hook ran). */
export function fakeBaseUrl(): string {
    return baseUrl;
}

export function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

/** Fake OpenAI: a model catalog plus a chat handler for the completion call. */
export function fakeOpenAi(models: string[], chat: FakeHandler) {
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

export function completion(content: string | null) {
    return {
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "x",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    };
}

export function generateRequest() {
    return new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        // autoInspect: false - these tests exercise generation, not TFP-122 inspection
        // (route.inspect.test.ts), and must never open a browser on :3000.
        body: JSON.stringify({ baseUrl: "http://localhost:3000", description: "check the home page", autoInspect: false }),
        headers: { "content-type": "application/json" },
    });
}

/** What the no-key path returns for the same request: the reference template output. */
export async function templateCode(): Promise<string> {
    delete process.env.OPENAI_API_KEY;
    const body = await (await POST(generateRequest())).json();
    return body.code;
}

/** Points the OpenAI path at the fake server. */
export function useFake(timeoutMs?: number) {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    process.env.OPENAI_BASE_URL = baseUrl;
    if (timeoutMs) process.env.TESTFORGE_OPENAI_TIMEOUT_MS = String(timeoutMs);
}
