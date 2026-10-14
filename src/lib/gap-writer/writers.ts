import { spawn } from "child_process";
import OpenAI from "openai";
import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_PLACEHOLDER_API_KEY, resolveOllamaModel, stripCodeFence } from "@/lib/generate/ollama";
import { ollamaTimeoutMs } from "@/lib/generate/local-generation";

/**
 * Phase 42 (TFP-194, Decision 6): the writers of gap tests. Each writes the
 * body of one Playwright test for one uncovered element, and revises it from
 * what TestForge's run of it said. TestForge, not the writer, runs every
 * attempt, behind the read-only gate and the request guard (gap-run.ts).
 *
 * - Claude Code (`claude -p`, JSON output), once per gap: the first prompt,
 *   then each revision in the same session (`--resume`). Its cost is what
 *   it reports (`total_cost_usd`).
 * - The local model (Ollama), the offline option: one conversation, no cost.
 *
 * `TESTFORGE_CLAUDE_COMMAND` (a JSON array: the program and its first
 * arguments) replaces `claude`; tests point it at a stand-in.
 */

export interface GapTarget {
    /** The coverage map's key for the element. */
    key: string;
    page: string;
    name: string;
    kind: "element" | "link";
    /** How the template's own checks would find it (a Playwright locator expression), when there is one. */
    locator: string | null;
}

export interface GapWriterReply {
    body: string;
    costUsd: number | null;
}

export interface GapWriter {
    name: "claude-code" | "local-model";
    /** The first attempt. */
    write(target: GapTarget, baseUrl: string): Promise<GapWriterReply>;
    /** A revision, given what the last attempt's run said. */
    revise(feedback: string): Promise<GapWriterReply>;
}

export function gapPrompt(target: GapTarget, baseUrl: string): string {
    return [
        `Write the body of one Playwright test (TypeScript) that checks this ${target.kind} on ${baseUrl}${target.page}:`,
        `  ${target.name}${target.locator ? `\n  TestForge finds it with: ${target.locator}` : ""}`,
        "",
        "Rules:",
        `- The body runs inside \`async ({ page }) => { ... }\`. Start with \`await page.goto('${target.page}');\` (the base URL is set).`,
        "- Check that the element is there and does its job, read-only: you may look, hover, focus, type into a field and open a menu, but nothing may be sent except GET requests, and no form may be submitted. Any other request fails the test.",
        "- Use `expect` from @playwright/test. No imports, no `test(` call, no comments outside the body.",
        "- Answer with the body only, in one ```ts code block.",
    ].join("\n");
}

function body(text: string): string {
    return stripCodeFence(text).trim();
}

function claudeCommand(): string[] {
    const configured = process.env.TESTFORGE_CLAUDE_COMMAND?.trim();
    if (configured) {
        const parsed = JSON.parse(configured) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((part) => typeof part === "string")) return parsed as string[];
        throw new Error("TESTFORGE_CLAUDE_COMMAND must be a JSON array of strings");
    }
    return ["claude"];
}

/**
 * One `claude -p` call. The prompt goes in on stdin, never as an argument: it
 * carries text read from the site, and on Windows `claude` is a .cmd shim run
 * through the shell. The arguments are fixed, and a session id must look like one.
 */
async function runClaude(prompt: string, session: string | null): Promise<{ result: string; costUsd: number | null; sessionId: string | null }> {
    const [program, ...first] = claudeCommand();
    if (session !== null && !/^[A-Za-z0-9-]{1,100}$/.test(session)) throw new Error("Claude Code returned a session id TestForge won't pass on");
    const args = ["-p", "--output-format", "json", ...(session ? ["--resume", session] : [])];
    const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(program, [...first, ...args], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" && program === "claude" });
        child.stdin.end(prompt, "utf8");
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
        child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve(stdout) : reject(new Error(`Claude Code exited with ${code}: ${stderr.trim().slice(0, 400)}`))));
    });
    const reply = JSON.parse(output) as { result?: unknown; total_cost_usd?: unknown; session_id?: unknown; is_error?: unknown };
    if (reply.is_error === true || typeof reply.result !== "string") throw new Error(`Claude Code answered with no result: ${output.slice(0, 400)}`);
    return { result: reply.result, costUsd: typeof reply.total_cost_usd === "number" ? reply.total_cost_usd : null, sessionId: typeof reply.session_id === "string" ? reply.session_id : null };
}

export function claudeCodeWriter(): GapWriter {
    let session: string | null = null;
    return {
        name: "claude-code",
        async write(target, baseUrl) {
            const reply = await runClaude(gapPrompt(target, baseUrl), null);
            session = reply.sessionId;
            return { body: body(reply.result), costUsd: reply.costUsd };
        },
        async revise(feedback) {
            const reply = await runClaude(feedback, session);
            session = reply.sessionId ?? session;
            return { body: body(reply.result), costUsd: reply.costUsd };
        },
    };
}

export function localModelWriter(configuredModel: string): GapWriter {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    const client = new OpenAI({ apiKey: OLLAMA_PLACEHOLDER_API_KEY, baseURL: process.env.TESTFORGE_OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL, maxRetries: 0 });
    let model: string | null = null;
    const ask = async (content: string): Promise<GapWriterReply> => {
        const signal = AbortSignal.timeout(ollamaTimeoutMs());
        model ??= resolveOllamaModel((await client.models.list({ signal })).data.map((entry) => entry.id), configuredModel);
        if (!model) throw new Error(`Ollama has no model "${configuredModel}"`);
        messages.push({ role: "user", content });
        const chat = await client.chat.completions.create({ model, messages, temperature: 0.2 }, { signal });
        const text = chat.choices[0]?.message?.content ?? "";
        messages.push({ role: "assistant", content: text });
        return { body: body(text), costUsd: null };
    };
    return {
        name: "local-model",
        write: (target, baseUrl) => ask(gapPrompt(target, baseUrl)),
        revise: (feedback) => ask(feedback),
    };
}
