/**
 * Phase 38 Acceptance Criteria 2: the read-only conformance checks join the
 * Standard run through one implementation shared with Comprehensive.
 *
 * - TFP-147 (security): the Standard run's security checks are the
 *   Comprehensive run's passive checks, on every inspected page, with one
 *   missing-page probe.
 * - TFP-148 (accessibility): the Standard run runs the same axe-core WCAG
 *   2.2 A and AA scan on every inspected page, with the same impact split,
 *   and lists what axe could not decide for manual review.
 *
 * On the comparison fixture, for the clean site and each injected defect, a
 * Standard run and a Comprehensive run of the same pages report the same
 * outcome, findings, failure and issues for every shared check on every page,
 * and each defect is found on the page that carries it.
 *
 * ISTQB technique: equivalence partitioning - one partition per injected
 * defect (each a different class of exposure, hardening gap or WCAG
 * failure), plus the clean site.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/standard-conformance.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { ExecutionRecord, JsonReport, JsonSuite } from "../report/types.ts";

const { mockGenerate } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");
const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { inspectPages } = await import("../introspect/inspector.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { buildReport } = await import("../report/report.ts");
const { buildReportHtmlDocument } = await import("../report/html.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

const PAGES = ["/", "/login", "/notes"];
const PROBE = "/testforge-missing-";
const AXE_SCAN = "passes the WCAG 2.2 A and AA scan";

async function runSuite(code: string, label: string): Promise<{ records: ExecutionRecord[]; json: JsonReport }> {
    const { report } = await runPlaywrightSpec(code, `standard-conformance-unit-${label}`, [], { TESTFORGE_INTERACTIVE: "0" });
    return { records: flattenSuites(report.suites), json: report };
}

interface Outcome {
    status: ExecutionRecord["status"];
    findings: string[];
    failure: string;
    issues: string[];
}

/** Each shared check by page and title (ids dropped): its outcome, findings, failure and issues, the probe's random path masked. */
function outcomes(records: ExecutionRecord[], keep: (record: ExecutionRecord) => boolean = () => true): Record<string, Outcome> {
    const mask = (text: string) => text.replace(/\/testforge-missing-[a-z0-9]+/g, "/testforge-missing-<id>");
    return Object.fromEntries(records
        .filter((record) => record.page && keep(record))
        .map((record): [string, Outcome] => [`${record.page} | ${record.title.replace(/^TF[A-Z]+-\d+: /, "")}`, {
            status: record.status,
            findings: [...(record.findings ?? [])].map(mask).sort(),
            failure: record.status === "Failed" ? mask(record.rawMessage.split("\n")[0]) : "",
            issues: (record.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`).sort(),
        }])
        .sort(([a], [b]) => a.localeCompare(b)));
}

async function inspectFixture(fixture: Awaited<ReturnType<typeof startRecordedFixture>>) {
    const inspection = await inspectPages(fixture.origin, PAGES);
    assert.deepEqual(inspection.pages.map((page) => page.path), PAGES);
    return { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
}

// What each defect must change, and where: [page, check title, what the outcome must contain].
const SECURITY_DEFECTS: Record<string, { page: string; check: string; shows: RegExp }> = {
    "security-password-to-http": { page: "/login", check: "/login keeps passwords off plain HTTP", shows: /sends a password field to the plain-HTTP address http:\/\/login\.acme-notes\.invalid\/session/ },
    "security-token-in-url": { page: "/", check: "/ puts no password or session token in a URL", shows: /carries sessionid in its URL/ },
    "security-stack-trace": { page: "(missing-page probe)", check: "a page that cannot exist shows no stack trace or server file path", shows: /stack trace|server file path/ },
    "security-version-header": { page: "/", check: "/ names no software version in its response headers", shows: /x-powered-by: Express\/4\.18\.2 on \/ names a software version/ },
    "security-weak-session-cookie": { page: "/", check: "/ sends its security headers and session cookies", shows: /session cookie "sid" set on \/ (has no HttpOnly|stays valid for 400 days)/ },
    "security-mixed-cookies": { page: "/", check: "/ sends its security headers and session cookies", shows: /session cookie "sid" set on \/ has no HttpOnly/ },
};

// Phase 41: checks only a Comprehensive security run makes (Decision 5; their placement an owner decision,
// 2026-10-12) - TFP-184's guessable ids and TFP-185's API fields per page, and the known-path probe once. The shared checks must agree.
const COMPREHENSIVE_ONLY = /uses no guessable sequential ids|fetches no internal fields|known paths that leak/;
const COMPREHENSIVE_ONLY_PER_PAGE = 2;

test("in a real browser: on the fixture, a Standard security run and a Comprehensive one report the same for every page, for the clean site and each passive defect; the Standard run sends one missing-page probe", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const profile = await inspectFixture(fixture);
        const standard = mockGenerate(fixture.origin, "Check the site.", ["security"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
        const mode = normalizeRunMode({ kind: "comprehensive", area: "security" }) as ComprehensiveRunMode;
        const comprehensive = buildComprehensiveSuite(fixture.origin, mode, { covered: PAGES, notCovered: [], pageCap: 20 });
        assert.deepEqual(findTypeErrors(standard), []);
        assert.doesNotMatch(standard, /landing page security headers|session cookies set by the site carry protective flags/, "Standard's own two tests are gone");

        let clean: Record<string, Outcome> | null = null;
        for (const defect of ["none", ...Object.keys(SECURITY_DEFECTS)]) {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            fixture.recorded.length = 0;
            const standardOutcomes = outcomes((await runSuite(standard, "standard")).records);
            const probes = fixture.recorded.filter((request) => request.path.startsWith(PROBE)).length;
            const comprehensiveRecords = (await runSuite(comprehensive, "comprehensive")).records;
            const comprehensiveOutcomes = outcomes(comprehensiveRecords, (record) => !COMPREHENSIVE_ONLY.test(record.title));
            assert.equal(comprehensiveRecords.filter((record) => COMPREHENSIVE_ONLY.test(record.title)).length, PAGES.length * COMPREHENSIVE_ONLY_PER_PAGE + 1, `${defect}: Comprehensive's own checks, per page and the known-path probe`);

            assert.equal(probes, 1, `${defect}: the Standard run sends exactly one missing-page probe`);
            assert.equal(Object.keys(standardOutcomes).length, PAGES.length * 4 + 1, `${defect}: 4 checks per page and the probe`);
            assert.deepEqual(standardOutcomes, comprehensiveOutcomes, `${defect}: Standard and Comprehensive disagree`);

            if (defect === "none") {
                clean = standardOutcomes;
                assert.ok(Object.values(clean).every((outcome) => outcome.status === "Passed"), JSON.stringify(clean));
                continue;
            }
            const { page, check, shows } = SECURITY_DEFECTS[defect];
            const key = `${page} | ${check}`;
            const outcome = standardOutcomes[key];
            assert.ok(outcome, `${defect}: no ${key} in ${Object.keys(standardOutcomes).join(", ")}`);
            assert.notDeepEqual(outcome, clean![key], `${defect}: ${key} is the same as on the clean site`);
            assert.match([...outcome.findings, outcome.failure].join("\n"), shows, `${defect}: ${JSON.stringify(outcome)}`);
        }
    } finally {
        await fixture.close();
    }
});

// The fixture's WCAG defects, the page each is on, and the axe rule and criterion it must fail under.
const ACCESSIBILITY_DEFECTS: Record<string, { page: string; shows: RegExp }> = {
    "a11y-unlabelled-field": { page: "/login", shows: /failure WCAG 4\.1\.2 label \(critical\)/ },
    "a11y-missing-alt": { page: "/", shows: /failure WCAG 1\.1\.1 image-alt \(critical\)/ },
    "a11y-low-contrast": { page: "/", shows: /failure WCAG 1\.4\.3 color-contrast \(serious\)/ },
};
// Text over a background image: axe cannot work out the contrast, so it reports the item as incomplete.
const UNDECIDED = "a11y-text-over-image";

test("in a real browser: on the fixture, the Standard run's axe scan and the Comprehensive one report the same for every page, for the clean site and each WCAG defect (TFP-148)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const profile = await inspectFixture(fixture);
        const standard = mockGenerate(fixture.origin, "Check the site.", ["accessibility"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
        const mode = normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as ComprehensiveRunMode;
        const comprehensive = buildComprehensiveSuite(fixture.origin, mode, { covered: PAGES, notCovered: [], pageCap: 20 });
        assert.deepEqual(findTypeErrors(standard), []);
        const isScan = (record: ExecutionRecord) => record.title.endsWith(AXE_SCAN);

        let clean: Record<string, Outcome> | null = null;
        for (const defect of ["none", UNDECIDED, ...Object.keys(ACCESSIBILITY_DEFECTS)]) {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const standardRun = await runSuite(standard, "standard-a11y");
            const standardScans = outcomes(standardRun.records, isScan);
            const comprehensiveScans = outcomes((await runSuite(comprehensive, "comprehensive-a11y")).records, isScan);

            assert.deepEqual(Object.keys(standardScans), PAGES.map((page) => `${page} | ${page} ${AXE_SCAN}`).sort(), `${defect}: one scan per inspected page`);
            assert.deepEqual(standardScans, comprehensiveScans, `${defect}: Standard and Comprehensive disagree`);

            // Undecided items: listed in the Standard report for a person to check, as many as the scans recorded.
            const report = buildReport(standardRun.json, ["accessibility"], "", fixture.origin);
            const undecided = Object.values(standardScans).flatMap((outcome) => outcome.issues.filter((issue) => issue.startsWith("manual-review ")));
            assert.equal(report.manualReview?.length ?? 0, undecided.length, `${defect}: ${JSON.stringify(report.manualReview)}`);

            if (defect === "none") {
                clean = standardScans;
                assert.ok(Object.values(standardScans).every((outcome) => outcome.status === "Passed"), JSON.stringify(standardScans));
                assert.ok(!report.manualReview?.some((item) => /color-contrast/.test(item.detail)), `the clean site leaves no contrast undecided: ${JSON.stringify(report.manualReview)}`);
                continue;
            }
            if (defect === UNDECIDED) {
                // Not counted as passed: the item is listed for a person to check, in the report and its HTML,
                // and is neither a finding nor a failure. The scan itself still passes (Phase 35 Decision 4).
                const home = standardScans[`/ | / ${AXE_SCAN}`];
                assert.equal(home.status, "Passed", JSON.stringify(home));
                assert.deepEqual(home.findings, clean![`/ | / ${AXE_SCAN}`].findings, "no new finding");
                assert.match(home.issues.join("\n"), /^manual-review WCAG 1\.4\.3 color-contrast: .* - p:nth-child\(2\)$/m, JSON.stringify(home));
                const listed = (report.manualReview ?? []).filter((item) => item.page === "/" && /^WCAG 1\.4\.3 color-contrast: /.test(item.detail));
                assert.equal(listed.length, 1, JSON.stringify(report.manualReview));
                const html = buildReportHtmlDocument(report, "r");
                assert.ok(html.includes(`Needs manual review (${report.manualReview!.length})`) && html.includes(listed[0].detail), "the HTML export lists it under Needs manual review");
                continue;
            }
            const { page, shows } = ACCESSIBILITY_DEFECTS[defect];
            const outcome = standardScans[`${page} | ${page} ${AXE_SCAN}`];
            assert.equal(outcome.status, "Failed", `${defect}: ${JSON.stringify(outcome)}`);
            assert.match(outcome.issues.join("\n"), shows, `${defect}: ${JSON.stringify(outcome)}`);
        }
    } finally {
        await fixture.close();
    }
});

test("the Standard report lists the scan's undecided items for manual review, by page, and a Comprehensive report does not repeat them there (TFP-148)", () => {
    const issue = (kind: string, category: string, detail: string) => ({ type: "issue", description: JSON.stringify({ kind, category, detail }) });
    const suites: JsonSuite[] = [{ title: "Accessibility Coverage", specs: [{ id: "a", title: `TFAC-009: /login ${AXE_SCAN}`, tests: [{ projectName: "chromium", status: "expected", annotations: [{ type: "page", description: "/login" }, { type: "gate", description: "read-only" }, issue("manual-review", "WCAG 1.4.3", "color-contrast: Elements must meet minimum color contrast ratio thresholds - .hero"), issue("finding", "WCAG 1.3.1", "region (moderate): ...")], results: [{ duration: 1, retry: 0, errors: [] }] }] }] }];
    const json: JsonReport = { suites, errors: [], stats: { duration: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 } };

    const standard = buildReport(json, ["accessibility"], "", "https://site.test");
    assert.deepEqual(standard.manualReview, [{ page: "/login", title: `TFAC-009: /login ${AXE_SCAN}`, detail: "WCAG 1.4.3 color-contrast: Elements must meet minimum color contrast ratio thresholds - .hero" }]);
    assert.equal(standard.summary.passed, 1, "an undecided item is not a failure, and the scan still passed");
    const html = buildReportHtmlDocument(standard, "r");
    assert.ok(html.includes("Needs manual review (1)") && html.includes("WCAG 1.4.3 color-contrast: Elements must meet minimum color contrast ratio thresholds - .hero"), "the HTML export lists it too");

    const none = buildReport({ ...json, suites: [] }, ["accessibility"], "", "https://site.test");
    assert.equal("manualReview" in none, false, "absent when there is nothing to review");

    const comprehensive = buildReport(json, ["accessibility"], "", "https://site.test", null, null, null, "", normalizeRunMode({ kind: "comprehensive", area: "accessibility" }), 1);
    assert.equal("manualReview" in comprehensive, false, "a Comprehensive report lists them in its own section");
});
