/**
 * Tests for the runId path-traversal guard on PATCH /api/runs
 * (TFP-066, Phase 24 reliability audit).
 *
 * The sharpest version of this finding: `archive: true` calls
 * `rm(runEvidenceDir(runId), { recursive: true, force: true })` - an
 * unvalidated runId here is a real deletion risk, not just a read risk.
 * Proven by planting a real directory OUTSIDE RUNS_ROOT that a successful
 * traversal would delete, and asserting it survives the request.
 *
 * Requires the bundler-style "@/" alias and "next/server" resolution that
 * route.ts uses at runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/runs/route.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-runs-route-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const { PATCH } = await import("./route.ts");
const { NextRequest } = await import("next/server");

after(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
});

before(async () => {
    await mkdir(process.env.TESTFORGE_RUNS_ROOT!, { recursive: true });
});

function patchRequest(body: unknown) {
    return new NextRequest(new URL("http://localhost/api/runs"), {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
    });
}

test("PATCH /api/runs archive: traversal-shaped runId is rejected with 400, target directory is never deleted", async () => {
    // runId "../canary-outside" against RUNS_ROOT = <scratchRoot>/runs
    // resolves (via runEvidenceDir -> path.join) to a directory OUTSIDE
    // runs/ entirely: <scratchRoot>/canary-outside/evidence.
    const canaryEvidenceDir = join(scratchRoot, "canary-outside", "evidence");
    await mkdir(canaryEvidenceDir, { recursive: true });
    const canaryFile = join(canaryEvidenceDir, "do-not-delete.txt");
    await writeFile(canaryFile, "still here", "utf8");

    const res = await PATCH(patchRequest({ runId: "../canary-outside", archive: true }));
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "runId must be a valid UUID");
    assert.ok(existsSync(canaryFile), "a path-traversal runId must not be able to delete a directory outside RUNS_ROOT");
});

test("PATCH /api/runs pinned: traversal-shaped runId is rejected with 400", async () => {
    const res = await PATCH(patchRequest({ runId: "../../outside", pinned: true }));
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "runId must be a valid UUID");
});

test("PATCH /api/runs: null-byte-embedded runId is rejected with 400", async () => {
    const res = await PATCH(patchRequest({ runId: `${randomUUID()}\u0000.txt`, archive: true }));
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "runId must be a valid UUID");
});

test("PATCH /api/runs archive: a real but unknown UUID is unaffected by the validator (404, not 400)", async () => {
    const res = await PATCH(patchRequest({ runId: randomUUID(), archive: true }));
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.error, "Run not found");
});
