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

const { flattenSuites, capStarvedCount, REQUEST_CAP_WAIT_ANNOTATION, REQUEST_CAP_STARVED_ANNOTATION } = await import("./execution.ts");

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

/** One test with the given Playwright status and annotations, as the JSON reporter writes it. */
function oneTest(status: "expected" | "unexpected", annotations: Array<{ type: string; description?: string }>) {
    return [{
        title: "suite.spec.ts",
        specs: [],
        suites: [{
            title: "Functional Coverage",
            specs: [{
                id: "c1",
                title: "TFFU-001: a page of 200 images loads",
                tests: [{ projectName: "chromium", status, annotations, results: [{ duration: 31_000, retry: 0, errors: [{ message: "Test timeout of 30000ms exceeded." }], status: status === "expected" ? "passed" : "timedOut" }] }],
            }],
        }],
    }];
}

test("flattenSuites: on a capped host, a failure the cap starved is Not run with its reason and wait; any other result stands (TFP-264, decision table)", () => {
    const starved = "starved by the request cap: it waited 29.8 s for request slots, longer than its 5 s assertion wait, so its failure says nothing about the site";
    const cases: Array<[string, "expected" | "unexpected", Array<{ type: string; description?: string }>, string, string | undefined, number | undefined]> = [
        ["failed, starved", "unexpected", [{ type: REQUEST_CAP_WAIT_ANNOTATION, description: "29800" }, { type: REQUEST_CAP_STARVED_ANNOTATION, description: starved }], "Not run", starved, 29_800],
        ["failed, little waiting", "unexpected", [{ type: REQUEST_CAP_WAIT_ANNOTATION, description: "120" }], "Failed", undefined, 120],
        ["passed after waiting", "expected", [{ type: REQUEST_CAP_WAIT_ANNOTATION, description: "9000" }], "Passed", undefined, 9_000],
        // The fixture never writes this on a pass; if one is there, a pass still stands.
        ["passed, starved annotation", "expected", [{ type: REQUEST_CAP_STARVED_ANNOTATION, description: starved }], "Passed", undefined, undefined],
        ["uncapped failure", "unexpected", [], "Failed", undefined, undefined],
    ];
    for (const [name, status, annotations, want, reason, wait] of cases) {
        const [record] = flattenSuites(oneTest(status, annotations));
        assert.equal(record.status, want, name);
        assert.equal(record.skipReason, reason, name);
        assert.equal(record.requestCapWaitMs, wait, name);
    }
    const [notRun] = flattenSuites(oneTest("unexpected", [{ type: REQUEST_CAP_STARVED_ANNOTATION, description: starved }]));
    assert.match(notRun.remarks, /^Not run\. .* did not run: starved by the request cap: it waited 29\.8 s/);
    assert.equal(capStarvedCount([notRun, ...flattenSuites(oneTest("unexpected", []))]), 1);
});

test("the request cap's fixture writes the annotations the report reads (TFP-264)", async () => {
    const { readFile } = await import("node:fs/promises");
    const fixture = await readFile(new URL("../run/request-cap-fixture.ts", import.meta.url), "utf8");
    assert.ok(fixture.includes(`const WAIT_ANNOTATION = "${REQUEST_CAP_WAIT_ANNOTATION}";`));
    assert.ok(fixture.includes(`const STARVED_ANNOTATION = "${REQUEST_CAP_STARVED_ANNOTATION}";`));
    assert.ok(fixture.includes("description: `starved by the request cap: "), "capStarvedCount's prefix");
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
