/**
 * Tests for createExecutionArtifacts (src/lib/report/artifacts.ts).
 *
 * TFP-243: Playwright 1.59.1 attaches a failed test's error-context.md a second
 * time when an afterAll hook follows it (its trace fixture is set up again for
 * the hook), and every shared visit ends with one.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/artifacts.test.ts
 */
import assert from "node:assert";
import { join } from "node:path";
import { test } from "node:test";

const { createExecutionArtifacts } = await import("./artifacts.ts");

const folder = join("artifacts-run", "test-1-chromium");

test("TFP-243: a file attached twice is listed once, and the ids stay in step with the list", () => {
    const artifacts = createExecutionArtifacts({
        attachments: [
            { name: "screenshot", contentType: "image/png", path: join(folder, "test-failed-1.png") },
            { name: "error-context", contentType: "text/markdown", path: join(folder, "error-context.md") },
            { name: "error-context", contentType: "text/markdown", path: join(folder, "error-context.md") },
            { name: "trace", contentType: "application/zip", path: join(folder, "trace.zip") },
        ],
    } as never, "test-1", "chromium");

    assert.deepStrictEqual(
        artifacts.map((artifact) => [artifact.artifactId, artifact.fileName]),
        [
            ["test-1-chromium-0", "test-failed-1.png"],
            ["test-1-chromium-1", "error-context.md"],
            ["test-1-chromium-2", "trace.zip"],
        ]
    );
});

test("TFP-243: two files of one name in different folders are both listed", () => {
    const artifacts = createExecutionArtifacts({
        attachments: [
            { name: "error-context", contentType: "text/markdown", path: join(folder, "error-context.md") },
            { name: "error-context", contentType: "text/markdown", path: join("artifacts-run", "test-2-chromium", "error-context.md") },
        ],
    } as never, "test-1", "chromium");

    assert.equal(artifacts.length, 2);
});
