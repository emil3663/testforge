/**
 * Queued runs are claimed once and driven through this server's own API; a
 * stop asked for in napi cancels the run here. Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/napi/poller.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { activeClaims, claimRun } from "./claims.ts";
import { NapiClient, type NapiRunConfig } from "./client.ts";
import { DEFAULT_DESCRIPTION, generateBody, pollOnce, runBody } from "./poller.ts";

const CONFIG = { url: "http://napi.test", clientId: "id", clientSecret: "s", companyId: "company-1", selfUrl: "http://127.0.0.1:3000", pollSeconds: 0 };
const SCOPE: NapiRunConfig = { runId: "queued-1", baseUrl: "http://127.0.0.1:4100", selectedPractices: ["accessibility", "security"], auditMode: "deep", description: null, login: { loginUrl: "/login", usernameEnv: "U", passwordEnv: "P" } };

test("napi's run config becomes a generate body and a run body in TestForge's own words", () => {
    assert.deepEqual(generateBody(SCOPE), { baseUrl: "http://127.0.0.1:4100", description: DEFAULT_DESCRIPTION, selectedPractices: ["accessibility", "security"], auditMode: "deep" });
    const run = runBody(SCOPE, { code: "// suite", generatedBy: "template", gates: [], siteSuite: { reused: 3 } });
    assert.equal(run.code, "// suite");
    assert.deepEqual(run.login, SCOPE.login);
    assert.deepEqual(run.generation, { generatedBy: "template", gates: [], siteSuite: { reused: 3 } });
    assert.equal(runBody({ ...SCOPE, description: " The documents page " }, { code: "x" }).description, "The documents page");
});

test("one pass claims a queued run once, generates and starts it here, and cancels what napi says is stopping", async () => {
    const calls: string[] = [];
    const napi = async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url.replace("http://napi.test", "")}`);
        if (url.endsWith("/oauth/token")) return json({ access_token: "t", expires_in: 60 });
        if (url.includes("scopes=queued")) return json({ data: [
            { uuid: "row-a", run_uid: "queued-a", status: "queued", scope_file: SCOPE },
            { uuid: "row-b", run_uid: "queued-b", status: "queued", scope_file: SCOPE },
            { uuid: "row-c", run_uid: "queued-c", status: "queued", scope_file: null },
        ] });
        if (url.endsWith("/row-b/hand-off")) return json({ message: "taken" }, 409);
        if (url.endsWith("/hand-off")) return json({ data: { status: "started" } });
        if (url.endsWith("/testforge-runs/row-old")) return json({ data: { uuid: "row-old", run_uid: "queued-old", status: "stopping", scope_file: null } });
        return json({}, 404);
    };
    const self = async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url.replace("http://127.0.0.1:3000", "self")}`);
        if (url.endsWith("/api/crawl") && init?.method === "POST") return json({ crawlId: "c1", crawlStatus: "running" }, 202);
        if (url.includes("/api/crawl?crawlId=c1")) return json({ crawlStatus: "completed", result: { pages: [{ path: "/" }, { path: "/forgot-password" }, { path: "/login" }], pageSelection: { standard: { pages: ["/", "/forgot-password"] } } } });
        if (url.endsWith("/api/introspect")) {
            assert.deepEqual(JSON.parse(String(init?.body)).paths, ["/", "/forgot-password"]);
            return json({ pages: [{ path: "/" }, { path: "/forgot-password" }] });
        }
        if (url.endsWith("/api/generate")) {
            const g = JSON.parse(String(init?.body));
            assert.equal(g.auditMode, "deep");
            assert.deepEqual(g.contentRules.paths, ["/", "/forgot-password"], "the crawl's pages reach generation");
            assert.equal(g.contentProfile.pages.length, 2);
            return json({ code: "// generated", generatedBy: "template", gates: [] });
        }
        if (url.endsWith("/api/run") && init?.method === "POST") {
            const body = JSON.parse(String(init?.body));
            assert.equal(body.code, "// generated");
            assert.equal(body.generation.generatedBy, "template");
            assert.equal(body.contentProfile.pages.length, 2, "the run is measured against the inspection");
            assert.deepEqual(body.generation.pageTypes, { pages: ["/", "/forgot-password"] });
            return json({ runId: "tf-run-1" }, 202);
        }
        if (url.endsWith("/api/run") && init?.method === "DELETE") return json({ runId: JSON.parse(String(init?.body)).runId });
        return json({}, 404);
    };
    claimRun("tf-run-old", { uuid: "row-old", runUid: "queued-old" });
    const lines: string[] = [];

    await pollOnce({ client: new NapiClient(CONFIG, napi), config: CONFIG, fetchImpl: self, log: (l) => lines.push(l), sleep: async () => {} });

    assert.ok(calls.includes("DELETE self/api/run"), "the stopping run was cancelled here");
    assert.ok(calls.includes("POST /api/v2/testforge-runs/row-a/hand-off"));
    assert.ok(calls.includes("POST /api/v2/testforge-runs/row-b/hand-off"));
    assert.equal(calls.filter((c) => c === "POST self/api/generate").length, 1, "the run another TestForge took is not generated, nor the one without a config");
    assert.equal(calls.filter((c) => c === "POST self/api/run").length, 1);
    assert.deepEqual(activeClaims().find(([id]) => id === "tf-run-1")?.[1], { uuid: "row-a", runUid: "queued-a" });
    assert.ok(lines.some((l) => l.includes("queued-c has no config")));
    assert.ok(lines.some((l) => l.includes("queued-a started here as tf-run-1")));
    assert.ok(lines.some((l) => l.includes("3 page(s) found, 2 selected")));
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
