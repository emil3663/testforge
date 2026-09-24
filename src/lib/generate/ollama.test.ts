/**
 * Tests for the local-generation helpers (Phase 30, TFP-103).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/ollama.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { resolveOllamaModel, stripCodeFence } = await import("./ollama.ts");

test("resolveOllamaModel: an untagged name matches its :latest entry", () => {
    assert.equal(resolveOllamaModel(["a:7b", "testforge-qwen7b:latest"], "testforge-qwen7b"), "testforge-qwen7b:latest");
});

test("resolveOllamaModel: a tagged name matches only that exact tag", () => {
    assert.equal(resolveOllamaModel(["m:latest", "m:7b"], "m:7b"), "m:7b");
    assert.equal(resolveOllamaModel(["m:latest"], "m:7b"), null);
});

test("resolveOllamaModel: no prefix or pattern matching", () => {
    assert.equal(resolveOllamaModel(["testforge-qwen7b-old:latest", "qwen2.5-coder:7b"], "testforge-qwen7b"), null);
});

test("stripCodeFence: removes a language-tagged fence", () => {
    assert.equal(stripCodeFence("```typescript\nconst a = 1;\n```"), "const a = 1;");
});

test("stripCodeFence: removes a bare fence and surrounding whitespace", () => {
    assert.equal(stripCodeFence("\n  ```\nconst a = 1;\n```  \n"), "const a = 1;");
});

test("stripCodeFence: handles CRLF line endings", () => {
    assert.equal(stripCodeFence("```ts\r\nconst a = 1;\r\n```"), "const a = 1;");
});

test("stripCodeFence: an unclosed fence (truncated output) still loses its opening line", () => {
    assert.equal(stripCodeFence("```ts\nconst a = 1;"), "const a = 1;");
});

test("stripCodeFence: unfenced code is returned unchanged", () => {
    assert.equal(stripCodeFence("const a = 1;"), "const a = 1;");
});

test("stripCodeFence: a fence in the middle of the code is left alone", () => {
    const code = "const md = `\n```\nx`;";
    assert.equal(stripCodeFence(code), code);
});
