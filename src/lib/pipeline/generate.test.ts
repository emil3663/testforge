/**
 * Phase 47 Decision 9 (TFP-245): with models off, as in CI, no model writes anything - a configured OpenAI key and
 * local model are never asked, and the suite is the template's. With them on (the route's default) nothing changed.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/pipeline/generate.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { chatBodies, completion, fakeBaseUrl, fakeOpenAi, installFakeServer, json, templateCode, useFake } from "../../app/api/generate/route-test-helpers.ts";
import { generateSuite } from "./generate.ts";

installFakeServer();

const REQUEST = { baseUrl: "http://localhost:3000", description: "check the home page", autoInspect: false };

test("models off: an OpenAI key is never used; the suite is the template's, with no generatedBy", async () => {
    const expected = await templateCode();
    fakeOpenAi(["gpt-4.1-mini"], (_req, res) => json(res, 200, completion("// written by the model")));
    useFake();

    const off = await generateSuite(REQUEST, { models: false });
    assert.ok(off.ok);
    assert.equal(off.body.code, expected);
    assert.equal(off.body.generatedBy, undefined);
    assert.equal(chatBodies.length, 0, "the model was never asked");

    const on = await generateSuite(REQUEST);
    assert.ok(on.ok);
    assert.equal(on.body.generatedBy, "openai", "with models on, the same key is used: the route's behaviour");
});

test("models off: a configured local model is never asked to fill gaps either", async () => {
    const expected = await templateCode();
    process.env.TESTFORGE_OLLAMA_MODEL = "qwen2.5-coder:7b";
    process.env.TESTFORGE_OLLAMA_BASE_URL = fakeBaseUrl().replace(/\/v1$/, "");
    process.env.TESTFORGE_OLLAMA_TIMEOUT_MS = "2000";

    const off = await generateSuite(REQUEST, { models: false });
    assert.ok(off.ok);
    assert.equal(off.body.code, expected);
    assert.equal(off.body.generatedBy, undefined);
    assert.equal(off.body.gapFill, undefined, "no gap fill was tried");
});
