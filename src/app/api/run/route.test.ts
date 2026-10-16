/**
 * Tests for the runId path-traversal guard on GET/DELETE /api/run
 * (TFP-066, Phase 24 reliability audit).
 *
 * The property that matters: runId flows into path.join(RUNS_ROOT, runId,
 * ...) in persistence.ts, which resolves ".." segments. A traversal-shaped
 * runId must be rejected with 400 before it ever reaches a filesystem call
 * - proven here by planting a real file/dir OUTSIDE RUNS_ROOT that a
 * successful traversal would read, and asserting the route never returns
 * its contents.
 *
 * Requires the bundler-style "@/" alias and "next/server" resolution that
 * route.ts uses at runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/run/route.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-run-route-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const { GET, DELETE, POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");

after(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
});

before(async () => {
    await mkdir(process.env.TESTFORGE_RUNS_ROOT!, { recursive: true });
});

async function plantSecretRunOutsideRunsRoot() {
    // runId "../secret-outside" against RUNS_ROOT = <scratchRoot>/runs
    // resolves (via path.join) to <scratchRoot>/secret-outside - one level
    // OUTSIDE the runs directory. If validation is bypassed, GET would
    // read this file and leak it in the response.
    const secretDir = join(scratchRoot, "secret-outside");
    await mkdir(secretDir, { recursive: true });
    await writeFile(
        join(secretDir, "run.json"),
        JSON.stringify({ runId: "SECRET-LEAKED", baseUrl: "SECRET-LEAKED", result: { runStatus: "passed" } }),
        "utf8"
    );
    return secretDir;
}

test("GET /api/run: traversal-shaped runId is rejected with 400, never reads the target file", async () => {
    await plantSecretRunOutsideRunsRoot();

    const req = new NextRequest(new URL("http://localhost/api/run?runId=../secret-outside"));
    const res = await GET(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "runId must be a valid UUID");
    assert.notEqual(body.baseUrl, "SECRET-LEAKED", "the traversal target's content must never reach the response");
});

test("GET /api/run: absolute-path-shaped runId is rejected with 400", async () => {
    const req = new NextRequest(new URL(`http://localhost/api/run?runId=${encodeURIComponent("/etc/passwd")}`));
    const res = await GET(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "runId must be a valid UUID");
});

test("GET /api/run: a real but unknown UUID is unaffected by the validator (404, not 400)", async () => {
    const req = new NextRequest(new URL(`http://localhost/api/run?runId=${randomUUID()}`));
    const res = await GET(req);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.error, "Run not found");
});

test("DELETE /api/run: traversal-shaped runId is rejected with 400", async () => {
    const req = new NextRequest(new URL("http://localhost/api/run"), {
        method: "DELETE",
        body: JSON.stringify({ runId: "../../outside" }),
        headers: { "content-type": "application/json" },
    });
    const res = await DELETE(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "runId must be a valid UUID");
});

test("DELETE /api/run: a real but unknown UUID is unaffected by the validator (404, not 400)", async () => {
    const req = new NextRequest(new URL("http://localhost/api/run"), {
        method: "DELETE",
        body: JSON.stringify({ runId: randomUUID() }),
        headers: { "content-type": "application/json" },
    });
    const res = await DELETE(req);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.error, "Run not found");
});

// TFP-067: req.json() error handling. The existing "code is required" check
// already returns 400 for any falsy `code`, so guarding req.json() with
// .catch(() => ({})) is enough here - no separate malformed-body branch
// needed, unlike crawl/introspect where baseUrl is optional.
test("POST /api/run: truncated JSON body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/run"), {
        method: "POST",
        body: "{not valid json",
        headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

/**
 * TFP-208: an artifact asked for while its run is being saved is served once the save is done, not refused.
 * ISTQB technique: state transition - a finished run goes from saving (its evidence being moved into its folder)
 * to saved. The regression suite's evidence download failed once (2026-10-16) with 404 "Artifact file is
 * unavailable": the run read as finished, and its file had just been moved. Here the save moves the file at
 * once and names its new place only later; a request in between must wait and get the file.
 */
test("GET /api/run?artifactId: during the run's save, waits for it and serves the moved file (TFP-208)", async () => {
    const { runJobs } = await import("../../../lib/run/jobs.ts");
    const { runEvidenceDir } = await import("../../../lib/run/persistence.ts");
    const runId = randomUUID();
    const artifactDir = join(scratchRoot, `artifacts-${runId}`);
    await mkdir(artifactDir, { recursive: true });
    const oldPath = join(artifactDir, "video.webm");
    await writeFile(oldPath, "the video", "utf8");
    const newPath = join(runEvidenceDir(runId), "video.webm");
    const job = {
        id: runId,
        artifactDir,
        artifactFiles: new Map([["video", { filePath: oldPath, fileName: "video.webm", contentType: "video/webm" }]]),
        result: { runId, runStatus: "failed" },
        saving: undefined as Promise<void> | undefined,
    };
    let finish: () => void = () => undefined;
    job.saving = (async () => {
        await mkdir(runEvidenceDir(runId), { recursive: true });
        await rename(oldPath, newPath);
        await new Promise<void>((done) => { finish = done; });
        job.artifactFiles = new Map([["video", { filePath: newPath, fileName: "video.webm", contentType: "video/webm" }]]);
    })();
    runJobs.set(runId, job as never);
    try {
        while (existsSync(oldPath)) await new Promise((done) => setTimeout(done, 10));
        const pending = GET(new NextRequest(new URL(`http://localhost/api/run?runId=${runId}&artifactId=video`)));
        setTimeout(() => finish(), 50);
        const res = await pending;
        assert.equal(res.status, 200);
        assert.equal(await res.text(), "the video");
    } finally {
        runJobs.delete(runId);
    }
});
