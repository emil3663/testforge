/**
 * Phase 34 TFP-122 (Decision 11): POST /api/generate inspects the pages itself
 * when a request brings no page data - through the real introspection code and
 * a real browser, against a small local site; never blocking generation.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/generate/route.inspect.test.ts
 */
import assert from "node:assert";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { chatBodies, completion, fakeBaseUrl, fakeOpenAi, installFakeServer, json } from "./route-test-helpers.ts";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");
const { mockGenerate } = await import("../../../lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../../../lib/generate/normalize.ts");

installFakeServer();

const NOTES_FORM = `<!doctype html><title>Notes</title><h1>Notes</h1>
<form method="post" action="/notes"><label for="note">Note</label> <input id="note" name="note" type="text"> <button type="submit">Save note</button></form>`;

let site: Server;
let siteUrl = "";

before(async () => {
    site = createServer((req, res) => {
        if (req.url === "/" || req.url === "/notes") return res.writeHead(200, { "content-type": "text/html" }).end(NOTES_FORM);
        res.writeHead(404, { "content-type": "text/html" }).end("<!doctype html><title>404</title><h1>Not found</h1>");
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
    siteUrl = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
});

after(async () => {
    site.closeAllConnections();
    await new Promise<void>((resolve) => site.close(() => resolve()));
});

async function generate(body: Record<string, unknown>) {
    const res = await POST(new NextRequest(new URL("http://localhost/api/generate"), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    assert.equal(res.status, 200);
    return res.json();
}

/** What generation without page data produced before TFP-122. */
function withoutPageData(baseUrl: string, practices: string[]) {
    return mockGenerate(baseUrl, "Check that notes are saved.", practices as never, null, normalizeContentRules(undefined), normalizeTestAuditMode(undefined));
}

test("no page data: the pages are inspected, the suite is built from them, and the response says so", async () => {
    const body = await generate({ baseUrl: siteUrl, description: "Check that notes are saved.", selectedPractices: ["database"] });
    assert.equal(body.generatedBy, "template");
    assert.deepEqual(body.pageInspection, { status: "inspected", paths: ["/"], pages: 1, warnings: [] });
    assert.match(body.code, /test\('TFDB-\d+: persistence round trip: Note on \/'/, "the inspected notes form gives the template a database round trip");
    assert.doesNotMatch(withoutPageData(siteUrl, ["database"]), /test\('TFDB-/, "which generation without page data could not write one");
});

test("the request's content-rule paths are the ones inspected", async () => {
    const body = await generate({ baseUrl: siteUrl, description: "Check that notes are saved.", selectedPractices: ["database"], contentRules: { paths: ["notes"] } });
    assert.deepEqual(body.pageInspection, { status: "inspected", paths: ["/notes"], pages: 1, warnings: [] });
    assert.match(body.code, /persistence round trip: Note on \/notes/);
});

/** A port that was just listening and is now closed: connection refused, fast. */
async function closedPort() {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const { port } = probe.address() as AddressInfo;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    return port;
}

test("inspection fails: today's output without page data, plus the reason - generation is never blocked", async () => {
    const closed = `http://127.0.0.1:${await closedPort()}`;
    const body = await generate({ baseUrl: closed, description: "Check that notes are saved.", selectedPractices: ["database"] });
    assert.deepEqual(Object.keys(body).sort(), ["code", "generatedBy", "pageInspection"]);
    assert.equal(body.code, withoutPageData(closed, ["database"]));
    assert.equal(body.pageInspection.status, "failed");
    assert.equal(body.pageInspection.pages, 0);
    // One readable line: no terminal colour codes, no Playwright call log.
    assert.equal(body.pageInspection.reason, `Could not inspect ${closed}/: page.goto: net::ERR_CONNECTION_REFUSED at ${closed}/`);
});

test("autoInspect: false behaves exactly as before TFP-122", async () => {
    const body = await generate({ baseUrl: siteUrl, description: "Check that notes are saved.", selectedPractices: ["database"], autoInspect: false });
    assert.deepEqual(body, { code: withoutPageData(siteUrl, ["database"]) });
});

test("supplied page data is used as-is and nothing is inspected", async () => {
    const body = await generate({ baseUrl: "http://127.0.0.1:9", description: "Check that notes are saved.", selectedPractices: ["database"], contentProfile: { pages: [] } });
    assert.equal(body.pageInspection, undefined);
    assert.deepEqual(Object.keys(body), ["code"]);
});

test("with a local model configured, an inspected database request is no gap: the model is not called", async () => {
    let chatCalls = 0;
    fakeOpenAi(["testforge-qwen7b:latest"], (_req, res) => {
        chatCalls += 1;
        json(res, 200, completion("test('x', async () => {});"));
    });
    process.env.TESTFORGE_OLLAMA_MODEL = "testforge-qwen7b";
    process.env.TESTFORGE_OLLAMA_BASE_URL = fakeBaseUrl();
    const body = await generate({ baseUrl: siteUrl, description: "Check that notes are saved.", selectedPractices: ["database"] });
    assert.equal(body.generatedBy, "template");
    assert.equal(body.gapFill.outcome, "no-gaps");
    assert.equal(body.pageInspection.status, "inspected");
    assert.equal(chatCalls + chatBodies.length, 0);
});
