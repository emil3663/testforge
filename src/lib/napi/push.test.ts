/**
 * A finished run reaches napi as persisted, minus the crawl snapshot, on the
 * row napi queued when there is one; a failed push is logged, never thrown.
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/napi/push.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { RunRecord } from "@/lib/run/persistence";
import { claimRun, claimedBy } from "./claims.ts";
import { NapiClient } from "./client.ts";
import { pushRunToNapi, recordForNapi } from "./push.ts";

const CONFIG = { url: "http://napi.test", clientId: "id", clientSecret: "s", companyId: "company-1", selfUrl: "http://127.0.0.1:3000", pollSeconds: 0 };

function record(runId: string): RunRecord {
    return {
        runId,
        baseUrl: "http://127.0.0.1:3000",
        description: "d",
        selectedPractices: ["accessibility"],
        auditMode: "fast",
        createdAt: "2026-10-16T21:46:48.220Z",
        finishedAt: "2026-10-16T21:48:53.008Z",
        pinned: false,
        retention: "full",
        lastAccessedAt: null,
        result: { runId, runStatus: "passed", passed: true, output: "", duration: 1, progress: {} as never, report: {} as never },
        artifactFiles: {},
        contentProfile: { pages: [] } as never,
    };
}

function fakeFetch(answer: (url: string, init?: RequestInit) => { status: number; json?: unknown }) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const impl = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const { status, json } = answer(url, init);
        return new Response(JSON.stringify(json ?? {}), { status, headers: { "Content-Type": "application/json" } });
    };
    return { impl, calls };
}

test("the record goes whole, minus the crawl snapshot", () => {
    const r = recordForNapi(record("run-1"));
    assert.equal(r.contentProfile, null);
    assert.equal(r.runId, "run-1");
    assert.equal(r.result.runStatus, "passed");
});

test("a push takes a token once, posts to ingest, names the claimed row, and releases the claim", async () => {
    const { impl, calls } = fakeFetch((url) => url.endsWith("/oauth/token") ? { status: 200, json: { access_token: "t0k", expires_in: 3600 } } : { status: 201, json: { data: {} } });
    const client = new NapiClient(CONFIG, impl);
    claimRun("run-2", { uuid: "row-uuid", runUid: "queued-abc" });
    const lines: string[] = [];

    assert.equal(await pushRunToNapi(client, record("run-2"), (l) => lines.push(l)), true);
    assert.equal(await pushRunToNapi(client, record("run-3"), (l) => lines.push(l)), true);

    const [token, first, second] = calls;
    assert.ok(token.url.endsWith("/oauth/token"));
    assert.equal(first.url, "http://napi.test/api/v2/testforge-runs/ingest");
    const body = JSON.parse(String(first.init?.body)) as { company_id: string; claimed?: string; run: { runId: string; contentProfile: unknown } };
    assert.equal(body.company_id, "company-1");
    assert.equal(body.claimed, "queued-abc");
    assert.equal(body.run.runId, "run-2");
    assert.equal(body.run.contentProfile, null);
    assert.equal((first.init?.headers as Record<string, string>).Authorization, "Bearer t0k");
    assert.equal(calls.length, 3, "the token is reused");
    assert.equal(JSON.parse(String(second.init?.body)).claimed, undefined, "an unasked-for run names no row");
    assert.equal(claimedBy("run-2"), undefined);
    assert.match(lines[0], /created on queued-abc/);
});

test("a push that napi refuses is logged and never throws", async () => {
    const { impl } = fakeFetch((url) => url.endsWith("/oauth/token") ? { status: 200, json: { access_token: "t", expires_in: 60 } } : { status: 422, json: { message: "no" } });
    const lines: string[] = [];
    assert.equal(await pushRunToNapi(new NapiClient(CONFIG, impl), record("run-4"), (l) => lines.push(l)), false);
    assert.match(lines[0], /was not pushed: napi POST .*ingest: 422/);
});
