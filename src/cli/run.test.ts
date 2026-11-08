/**
 * Phase 47 (TFP-245): `testforge run`'s exit codes for a run that couldn't run, its verdict on one that did, and the
 * suite it generates: the UI's, byte for byte, for the same page data.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/run.test.ts
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildSelectedPracticeDescription } from "../app/_lib/derive.ts";
import type { RunResultPayload } from "../lib/run/jobs.ts";
import { buildConfig } from "./config.ts";
import { buildGenerateRequest, EXIT, runTarget, verdictOf, writeOutputs } from "./run.ts";

const { POST } = await import("../app/api/generate/route.ts");
const { generateSuite } = await import("../lib/pipeline/generate.ts");
const { NextRequest } = await import("next/server");

async function closedPort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

test("TFP-272: a browser that can't start is reported, and the run exits 2", async (t) => {
    const { chromium } = await import("@playwright/test");
    t.mock.method(chromium, "launch", async () => {
        throw new Error("browserType.launch: Executable doesn't exist at /no/such/chrome\n╔══ box ══╗");
    });
    const lines: string[] = [];
    const code = await runTarget(buildConfig({}, { url: "http://localhost:4200" }, tmpdir()), (line) => lines.push(line));
    assert.equal(code, EXIT.couldNotRun);
    assert.ok(lines.includes("TestForge couldn't run: The crawl failed: The browser for the crawl could not start: browserType.launch: Executable doesn't exist at /no/such/chrome"), lines.join("\n"));
});

test("an unreachable URL: the crawl finds no page, exit 2, never 0", async () => {
    const port = await closedPort();
    const lines: string[] = [];
    const code = await runTarget(buildConfig({}, { url: `http://127.0.0.1:${port}` }, tmpdir()), (line) => lines.push(line));
    assert.equal(code, EXIT.couldNotRun);
    assert.match(lines.at(-1) ?? "", new RegExp(`^TestForge couldn't run: The crawl found no page at http://127\\.0\\.0\\.1:${port} \\(Could not crawl .*ERR_CONNECTION_REFUSED`));
});

test("Decision 7: a login value is redacted from every file in --out, page-data.json included", async (t) => {
    const out = await mkdtemp(join(tmpdir(), "tfp245-out-"));
    const saved = { user: process.env.TFP245_TEST_USER, pass: process.env.TFP245_TEST_PASS };
    process.env.TFP245_TEST_USER = "ada-the-tester";
    process.env.TFP245_TEST_PASS = "s3cret-Pa55";
    t.after(async () => {
        for (const [key, value] of [["TFP245_TEST_USER", saved.user], ["TFP245_TEST_PASS", saved.pass]] as const) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await rm(out, { recursive: true, force: true });
    });
    const config = buildConfig({}, { url: "http://localhost:4200", out, login: { loginUrl: "/login", usernameEnv: "TFP245_TEST_USER", passwordEnv: "TFP245_TEST_PASS", usernameSelector: "#email", passwordSelector: "#password", submitSelector: "button[type=submit]", postLoginPath: "/account" } }, tmpdir());
    const { createEmptyProgress } = await import("../lib/run/jobs.ts");
    // The secret where a page, a test and the output could each carry it.
    const job = { result: { runId: "r", runStatus: "failed", passed: false, output: "logged in as ada-the-tester with s3cret-Pa55", duration: 1, progress: createEmptyProgress() }, artifactFiles: new Map() } as never;
    const profile = { pages: [{ path: "/account", title: "Welcome, ada-the-tester", text: "password s3cret-Pa55" }] };
    await writeOutputs(config, job, "await page.fill('#password', 's3cret-Pa55');", profile, () => { });

    const files = ["report.json", "report.html", "suite.spec.ts", "page-data.json"];
    for (const file of files) {
        const text = await readFile(join(out, file), "utf8");
        assert.ok(!text.includes("s3cret-Pa55") && !text.includes("ada-the-tester"), `${file} still holds a login value`);
        assert.ok(text.includes("[redacted]"), `${file} shows where it was redacted`);
    }
});

function result(summary: Partial<NonNullable<RunResultPayload["report"]>["summary"]>, runStatus: RunResultPayload["runStatus"] = "passed"): RunResultPayload {
    const full = { planned: 10, executed: 10, passed: 10, failed: 0, flaky: 0, blocked: 0, notRun: 0, ...summary };
    return { runId: "r", runStatus, passed: runStatus === "passed", output: "", duration: 1, progress: {} as never, report: { summary: full } as never };
}

test("the verdict: 0 with no failures, 1 with a failed or blocked test, 2 when nothing executed or no report", () => {
    assert.equal(verdictOf(result({}), false).exitCode, EXIT.passed);
    assert.equal(verdictOf(result({ passed: 8, flaky: 1, notRun: 1, executed: 9 }), false).exitCode, EXIT.passed, "flaky and not run don't fail the build");
    assert.equal(verdictOf(result({ passed: 9, failed: 1 }, "failed"), false).exitCode, EXIT.failed);
    assert.equal(verdictOf(result({ passed: 9, blocked: 1, executed: 9 }), false).exitCode, EXIT.failed, "a blocked test didn't execute: never a pass");
    assert.equal(verdictOf(result({ passed: 9, failed: 1 }, "failed"), true).exitCode, EXIT.passed, "--report-only reports failures without failing");
    assert.equal(verdictOf(result({ passed: 0, notRun: 10, executed: 0 }), false).exitCode, EXIT.couldNotRun, "nothing executed is never a pass");
    assert.equal(verdictOf(result({ passed: 0, notRun: 10, executed: 0 }), true).exitCode, EXIT.couldNotRun, "not even with --report-only");
    assert.equal(verdictOf({ ...result({}, "failed"), report: undefined, output: "Run failed before a structured report was produced." }, false).exitCode, EXIT.couldNotRun);
    assert.equal(verdictOf(result({}, "cancelled"), false).exitCode, EXIT.couldNotRun, "a run stopped by its time budget");
    assert.match(verdictOf(result({ passed: 9, failed: 1 }, "failed"), false).summary, /^10 planned: 9 passed, 0 flaky, 1 failed, 0 blocked, 0 not run\.$/);
});

test("for the same page data the CLI's request is the UI's, and its suite the route's, byte for byte", async (t) => {
    const profile = JSON.parse(await readFile("benchmarks/2026-09-29/content-profile.json", "utf8"));
    const baseUrl = "http://127.0.0.1:4410";
    const paths = (profile.pages as Array<{ path: string }>).map((page) => page.path);
    const config = buildConfig({}, { url: baseUrl }, tmpdir());

    // useGeneration's body for these pages, all ten areas and nothing else chosen, as fetch sends it.
    const practices = config.practices;
    const uiBody = JSON.parse(JSON.stringify({
        baseUrl,
        description: buildSelectedPracticeDescription(practices),
        selectedPractices: practices,
        auditMode: "fast",
        contentRules: { paths, requiredHeadings: [], requiredText: [], forbiddenText: [], selectedJourneyIds: [] },
        contentProfile: profile,
    }));
    const cliRequest = buildGenerateRequest(config, paths, profile);
    assert.deepEqual(cliRequest, uiBody);

    // Each side in a data folder of its own: a site suite saved by one would be reused by the other.
    const saved = { dataDir: process.env.MRONION_DATA_DIR, key: process.env.OPENAI_API_KEY, local: process.env.MRONION_OLLAMA_MODEL };
    delete process.env.OPENAI_API_KEY;
    delete process.env.MRONION_OLLAMA_MODEL;
    const [uiData, cliData] = [await mkdtemp(join(tmpdir(), "tfp245-ui-")), await mkdtemp(join(tmpdir(), "tfp245-cli-"))];
    t.after(async () => {
        for (const [key, value] of [["MRONION_DATA_DIR", saved.dataDir], ["OPENAI_API_KEY", saved.key], ["MRONION_OLLAMA_MODEL", saved.local]] as const) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await Promise.all([uiData, cliData].map((dir) => rm(dir, { recursive: true, force: true })));
    });

    process.env.MRONION_DATA_DIR = uiData;
    const ui = await (await POST(new NextRequest(new URL("http://localhost/api/generate"), { method: "POST", body: JSON.stringify(uiBody), headers: { "content-type": "application/json" } }))).json();
    process.env.MRONION_DATA_DIR = cliData;
    const cli = await generateSuite(cliRequest, { models: false });

    assert.ok(cli.ok);
    assert.ok(typeof ui.code === "string" && ui.code.length > 1000);
    assert.equal(cli.body.code, ui.code);
});
