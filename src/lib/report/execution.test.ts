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

// --- Phase 34 (TFP-117): skipped tests say why ------------------------------

const { flattenSuites } = await import("./execution.ts");

function skippedSpec(annotations?: Array<{ type: string; description?: string }>) {
    return [
        {
            title: "suite.spec.ts",
            specs: [],
            suites: [
                {
                    title: "Database Coverage",
                    specs: [
                        {
                            id: "s1",
                            title: "TFDB-001: persistence round trip: Note on /notes",
                            tests: [{ projectName: "chromium", status: "skipped" as const, annotations, results: [{ duration: 0, retry: 0, errors: [], status: "skipped" }] }],
                        },
                    ],
                },
            ],
        },
    ];
}

test("flattenSuites: a test that skipped itself reports its own reason, not an interrupted run", () => {
    const reason = "database round trip: saves data through a form on the live site, so it only runs when TESTFORGE_INTERACTIVE=1 is set for the run";
    const [record] = flattenSuites(skippedSpec([{ type: "skip", description: reason }]));
    // Phase 34 Option C: a skip with a stated reason is "Not run", not "Blocked".
    assert.equal(record.status, "Not run");
    assert.equal(record.skipReason, reason);
    assert.equal(record.area, "Database");
    assert.match(record.remarks, /^Not run\. .* did not run: database round trip: saves data through a form on the live site/);
    assert.doesNotMatch(record.remarks, /interrupted/);
});

test("flattenSuites: a skipped or interrupted test with no stated reason keeps the generic wording", () => {
    for (const annotations of [undefined, [], [{ type: "skip" }], [{ type: "issue", description: "not a skip" }]]) {
        const [record] = flattenSuites(skippedSpec(annotations));
        assert.equal(record.status, "Blocked", "nobody chose an unexplained skip");
        assert.equal(record.skipReason, undefined);
        assert.match(record.remarks, /^Blocked\. .* could not be completed because the run was interrupted/);
    }
});

// --- Phase 34 (TFP-116): findings recorded without failing -------------------

function passedSpec(annotations: Array<{ type: string; description?: string }>) {
    const [root] = skippedSpec();
    const spec = root.suites![0].specs[0];
    spec.title = "TFSC-002: landing page security headers (recorded as findings)";
    spec.tests = [{ projectName: "chromium", status: "expected" as never, annotations, results: [{ duration: 5, retry: 0, errors: [], status: "passed" }] }];
    root.suites![0].title = "Security Coverage";
    return [root];
}

test("flattenSuites: finding annotations are kept on the record and appended to the remark, and the test still passes", () => {
    const [record] = flattenSuites(
        passedSpec([
            { type: "finding", description: "no Content-Security-Policy header: nothing limits what an injected script could do" },
            { type: "finding", description: 'cookie "sid" has no HttpOnly (scripts can read it)' },
            { type: "finding", description: 'cookie "sid" has no HttpOnly (scripts can read it)' },
            { type: "issue", description: "not a finding" },
        ])
    );
    assert.equal(record.status, "Passed");
    assert.deepEqual(record.findings, [
        "no Content-Security-Policy header: nothing limits what an injected script could do",
        'cookie "sid" has no HttpOnly (scripts can read it)',
    ]);
    assert.match(record.remarks, /^Passed\. .* Findings: no Content-Security-Policy header: .*; cookie "sid" has no HttpOnly \(scripts can read it\)\.$/);
});

test("flattenSuites: a test with no findings has an empty list and an unchanged remark", () => {
    const [record] = flattenSuites(passedSpec([]));
    assert.deepEqual(record.findings, []);
    assert.doesNotMatch(record.remarks, /Findings:/);
});

// --- Phase 34 (TFP-118): which generator wrote each test ----------------------

test("flattenSuites: tests inside Option B's 'Local model (...)' block are labelled local model, filed under their area", () => {
    const suites = [
        {
            title: "suite.spec.ts",
            specs: [],
            suites: [
                {
                    title: "Functional Coverage",
                    specs: [{ id: "t1", title: "TFFU-001: loads", tests: [{ projectName: "chromium", status: "expected" as never, results: [{ duration: 1, retry: 0, errors: [], status: "passed" }] }] }],
                },
                {
                    title: "Local model (testforge-qwen7b:latest)",
                    specs: [],
                    suites: [
                        {
                            title: "Database Coverage",
                            specs: [],
                            suites: [
                                {
                                    title: "Database",
                                    specs: [{ id: "l1", title: "a saved note is still shown after a reload", tests: [{ projectName: "chromium", status: "expected" as never, results: [{ duration: 1, retry: 0, errors: [], status: "passed" }] }] }],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ];
    const [template, local] = flattenSuites(suites);
    assert.equal(template.generator, "template");
    assert.doesNotMatch(template.remarks, /local model/);
    assert.equal(local.generator, "local model");
    assert.equal(local.area, "Database");
    assert.match(local.remarks, /Written by the local model \(testforge-qwen7b:latest\)\.$/);
});
