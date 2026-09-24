/**
 * Tests for deriveArea (src/lib/report/execution.ts).
 *
 * Phase 21 (TFP-098): model-written suites name their describe blocks after
 * the area ("Accessibility", "Performance/Load") rather than the template
 * generator's "... Coverage" suite names, and were all being filed as
 * Functional.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/execution.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { deriveArea, SUITE_AREA_MAP } = await import("./execution.ts");

test("deriveArea: the template generator's suite names map exactly as before", () => {
    for (const [suite, key] of Object.entries(SUITE_AREA_MAP)) {
        assert.equal(deriveArea(["", "suite.spec.ts", suite]).key, key, suite);
    }
});

test("deriveArea: describe blocks named after an area key or label map to that area", () => {
    const cases: Array<[string, string]> = [
        ["Accessibility", "accessibility"],
        ["Performance/Load", "performance/load"],
        ["Performance", "performance/load"],
        ["SEO/Content", "seo/content"],
        ["SEO", "seo/content"],
        ["Reliability", "reliability"],
        ["Database", "database"],
        ["Security", "security"],
        ["Responsive/Mobile", "responsive/mobile"],
        ["Cookie/Session", "cookie/session"],
        ["cookies", "cookie/session"],
        ["usability", "usability"],
        [" Functional ", "functional"],
    ];
    for (const [title, key] of cases) {
        assert.equal(deriveArea(["", "suite.spec.ts", title]).key, key, title);
    }
});

test("deriveArea: only whole titles match - a describe that merely mentions an area stays Functional", () => {
    for (const title of ["Login Page", "Login security notes", "Accessibility and more", "Reliability Tests"]) {
        assert.equal(deriveArea(["", "suite.spec.ts", title]).key, "functional", title);
    }
});
