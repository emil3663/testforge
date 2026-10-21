import type { TestGate } from "@/lib/run/test-gates";

// Phase 40's page types and Phase 42's site-suite and coverage-map records, kept in their own files (the 500-line limit).
import type { SiteSuiteRecord } from "./site-suite-types";
import type { CoverageMap } from "./coverage-map-types";
import type { PageTypeCoverageRecord } from "./page-type-types";
export type { PageTypeCoverageEntry, PageTypeCoverageRecord } from "./page-type-types";
export type { CandidateBindingRecord, GapWritingRecord, SiteSuiteRecheck, SiteSuiteRecord, SiteSuiteRegeneration } from "./site-suite-types";
export type { CoverageMap, CoverageMapEntry, CoverageMapKind, CoverageMapType } from "./coverage-map-types";

// "Not run" (Phase 34 Option C): the test skipped itself with a stated reason -
// not run by choice, e.g. interactive tests off. "Blocked" is a skip or
// interruption nobody explained.
export type ExecutionStatus = "Passed" | "Failed" | "Blocked" | "Flaky" | "Not run";
export type DefectSeverity = "Critical" | "Major" | "Minor";
export type FallbackExecutionStatus = "Passed" | "Failed" | "Blocked" | "Flaky" | "Interrupted" | "Not run";

export interface JsonReport {
    suites: JsonSuite[];
    errors: { message?: string }[];
    stats: {
        duration: number;
        expected: number;
        unexpected: number;
        flaky: number;
        skipped: number;
    };
}

export interface JsonSuite {
    title: string;
    specs: JsonSpec[];
    suites?: JsonSuite[];
}

export interface JsonSpec {
    title: string;
    tests: JsonTest[];
    id: string;
}

export interface JsonTest {
    projectName: string;
    results: JsonTestResult[];
    status: "expected" | "unexpected" | "flaky" | "skipped";
    /** e.g. { type: "skip", description } from test.skip(condition, description). */
    annotations?: Array<{ type: string; description?: string }>;
}

export interface JsonTestResult {
    status?: string;
    duration: number;
    retry: number;
    error?: { message?: string; stack?: string };
    errors: { message?: string }[];
    attachments?: Array<{
        name?: string;
        path?: string;
        contentType?: string;
    }>;
}

export interface ExecutionArtifact {
    artifactId: string;
    filePath: string;
    fileName: string;
    label: string;
    artifactType: "trace" | "video" | "screenshot" | "file";
    contentType: string;
}

export interface ExecutionRecord {
    id: string;
    title: string;
    description: string;
    suite: string;
    area: string;
    interactionType: "Navigation" | "API" | "Form" | "Action" | null;
    browser: string;
    status: ExecutionStatus;
    duration: number;
    remarks: string;
    /**
     * Phase 34 (TFP-116): things a test recorded without failing (Playwright
     * `finding` annotations), e.g. a missing security header. Also appended to
     * `remarks`, so every view that shows remarks shows them.
     */
    findings?: string[];
    /**
     * Phase 38 (TFP-149, Decision 5): values a test recorded with no pass or
     * fail (Playwright `measurement` annotations), e.g. total blocking time.
     * Also appended to `remarks`.
     */
    measurements?: string[];
    /**
     * Phase 34 (TFP-118): which generator wrote the test. Option B appends the
     * local model's tests to the template suite inside a describe titled
     * "Local model (<model>)"; everything else is the template's.
     */
    generator?: "template" | "local model" | "candidate";
    /** Phase 42 (TFP-195, TFP-203): the pool candidate the test was bound from (its `candidate` annotation), on either run type. */
    candidate?: string;
    /** Phase 34 Option C: why a "Not run" test did not run (its skip annotation). */
    skipReason?: string;
    /** Phase 38 Decision 1: the gate the test declared; absent on runs from before TFP-146. */
    gate?: TestGate;
    /** Phase 35 (TFP-132): the page a Comprehensive test checked (`page` annotation). */
    page?: string;
    /** Phase 35: its OWASP Top 10 category or WCAG criterion (`category` annotation). */
    category?: string;
    /** Phase 35: ASVS 5.0 requirement IDs it verifies (`asvs` annotations), e.g. "3.4.1". */
    asvs?: string[];
    /**
     * Phase 35 (TFP-134): the separate failures, findings and undecided items
     * one test recorded (`issue` annotations), each with its own category -
     * an axe scan finds many things on one page, each under its own WCAG
     * criterion.
     */
    issues?: ComprehensiveIssueRecord[];
    rawMessage: string;
    reproductionSteps: string[];
    artifacts: ExecutionArtifact[];
    order: number;
}

export interface ReportArtifactItem {
    artifactId: string;
    label: string;
    artifactType: "trace" | "video" | "screenshot" | "file";
    browser: string;
    testId: string;
    testTitle: string;
    fileName: string;
    defectId?: string;
    defectTitle?: string;
    downloadPath?: string;
}

export interface DefectRecord {
    id: string;
    testId: string;
    testTitle: string;
    title: string;
    summary: string;
    description: string;
    reproductionSteps: string[];
    severity: DefectSeverity;
    priority: DefectSeverity;
    status: "Open" | "Fixed" | "Closed";
    area: string;
    browser: string;
    artifacts: ReportArtifactItem[];
}

export interface UsabilityFindingRecord {
    id: string;
    summary: string;
    testId: string;
    testTitle: string;
    browser: string;
    defectId?: string;
    defectTitle?: string;
    artifacts: ReportArtifactItem[];
}

export interface CoverageMatrixItem {
    requirement: string;
    status: "covered" | "partial" | "uncovered";
    tests: string[];
    // Phase 17 Group 2 (TFP-071): present only for practice areas matched
    // against the discovered element surface (functional, accessibility) -
    // names the specific discovered elements with no matching executed
    // test, not just this row's area label.
    uncoveredElements?: string[];
    // Phase 17 Group 4 (TFP-073): a numeric per-area figure to diff between
    // two runs - covered-element ratio for discovered-surface areas,
    // passing-test ratio for the rest (0 when the area has no tests at all,
    // matching "uncovered").
    percentage: number;
}

// Phase 17 Group 3 (TFP-072): every discovered element with no matching
// executed test is bucketed into exactly one of these - "generator-gap" is
// the honest one and must not silently absorb the other two.
// "interactive-skipped": the test was generated and selected, but it submits
// forms on the live site, so it only runs when the run explicitly enabled
// interactive tests (TFP-091) - neither a generator gap nor a deselection.
export type NotTestedReason = "not-selected" | "excluded-by-generator" | "generator-gap" | "interactive-skipped";

export interface NotTestedElement {
    area: "functional" | "accessibility" | "reliability";
    path: string;
    elementName: string;
    elementType: string;
    containerLabel: string;
    reason: NotTestedReason;
    reasonDetail: string;
}

export interface SeoCheckRecord {
    title: string;
    browser: string;
    status: ExecutionStatus;
    remarks: string;
}

export interface SeoCheckSummary {
    id: string;
    label: string;
    description: string;
    status: "passed" | "failed" | "not-covered";
    evidence: SeoCheckRecord[];
}

export interface SeoPageCheckSummary extends SeoCheckSummary {
    pageKey: string;
    pageLabel: string;
}

export interface SeoPageGroup {
    pageKey: string;
    pageLabel: string;
    findings: string[];
    strengths: string[];
    checks: SeoPageCheckSummary[];
}

export interface SeoRecommendation {
    priority: "High" | "Medium" | "Low";
    title: string;
    rationale: string;
    pageKey?: string;
    pageLabel?: string;
}

export interface RunReport {
    summary: {
        planned: number;
        executed: number;
        passed: number;
        failed: number;
        blocked: number;
        flaky: number;
        /** Phase 34 Option C: tests that skipped themselves with a reason. */
        notRun: number;
        notRunReasons: { reason: string; count: number }[];
        /** Phase 38 Decision 1: Not run tests per declared gate; absent on runs from before TFP-146. */
        notRunByGate?: Record<TestGate, number>;
        /** e.g. "4 tests not run: interactive tests are off"; empty when none. */
        notRunNote: string;
        duration: number;
        releaseRecommendation: string;
        defectDistribution: {
            Critical: number;
            Major: number;
            Minor: number;
        };
        passFailRatio: {
            passed: number;
            failed: number;
        };
        browsers: string[];
        defectTrend: { label: string; count: number }[];
    };
    execution: ExecutionRecord[];
    defects: {
        issues: DefectRecord[];
        heatmap: { area: string; count: number }[];
    };
    coverage: {
        percentage: number;
        covered: number;
        total: number;
        uncovered: string[];
        matrix: CoverageMatrixItem[];
    };
    // Phase 17 Group 3 (TFP-072): persisted as part of the report itself,
    // not computed only in the UI, so a stored run's report is complete on
    // its own. Empty when no contentProfile was available for this run
    // (e.g. runs persisted before this field existed).
    notTested: NotTestedElement[];
    /** Phase 42 (TFP-192): absent when the run had no page data or no suite source. */
    coverageMap?: CoverageMap;
    /** Phase 39 (TFP-211): where the run's time went; absent on runs from before it, or when the timing reporter wrote nothing. */
    runTiming?: import("@/lib/run/timing").RunTiming;
    /**
     * Phase 39 (TFP-157, Decision 11): the worker count, the host's row in Decision 10, whether the ownership
     * confirmation was present, and on a capped host how many requests took a slot and how many waited. Absent on runs
     * from before it.
     */
    hostLimits?: import("@/lib/run/host-limits").HostLimits & { requestCap: import("@/lib/run/request-cap").RequestCapStats | null };
    // Phase 34 (TFP-119): how the suite was generated - the gap-fill outcome
    // and every gate's verdict - as recorded at generation (Decision 8). Null
    // when the run was started without one (template-only, or older runs).
    generation?: GenerationRecord | null;
    // Phase 34 (TFP-119, Decision 7): each area in scope that ended up with no
    // test at all, and why - never silently dropped.
    emptyAreas?: EmptyAreaRecord[];
    // Phase 38 (TFP-148, Decision 4): what the axe scan could not decide in a
    // Standard run ("incomplete"), by page - listed for a person to check,
    // never counted as passed. Absent when there is none, and on Comprehensive
    // runs, whose own section lists them.
    manualReview?: ComprehensiveIssue[];
    performance: {
        totalDuration: number;
        averageDuration: number;
        throughput: number;
        slowestTests: {
            title: string;
            browser: string;
            area: string;
            duration: number;
        }[];
        pageResponseTimes: {
            title: string;
            duration: number;
            browser: string;
        }[];
        resourceUtilization: string;
        scalability: string;
    };
    usability: {
        successRate: number;
        findings: UsabilityFindingRecord[];
        videoClips: string;
        sessionEvidence: ReportArtifactItem[];
        tasksCompleted: number;
        totalTasks: number;
    };
    // Phase 35 (TFP-132, Decision 7): present only on a Comprehensive run;
    // the report then shows this area alone. Absent on Standard runs.
    comprehensive?: ComprehensiveReport;
    seo: {
        requested: boolean;
        score: number;
        statusLabel: string;
        passedChecks: number;
        failedChecks: number;
        notCoveredChecks: number;
        totalChecks: number;
        checks: SeoCheckSummary[];
        pageGroups: SeoPageGroup[];
        findings: string[];
        strengths: string[];
        recommendations: SeoRecommendation[];
    };
    rawOutput: string;
}

// Phase 34 Decision 8: one gate's verdict, as the generate route recorded it.
export interface GenerationGateVerdict {
    gate: string;
    bar: string;
    measured: string;
    verdict: "kept" | "rejected";
    evidence: string[];
}

// Phase 34 (TFP-119): what /api/generate reported about how this suite was
// made, carried by the client into /api/run and persisted with the run.
export interface GenerationRecord {
    generatedBy: string;
    model?: string;
    fallbackReason?: string;
    gapFill?: { gapAreas: string[]; outcome: string };
    gates: GenerationGateVerdict[];
    /** Phase 34 TFP-122: present only when the request brought no page data and TestForge inspected the pages itself. */
    pageInspection?: PageInspectionRecord;
    /** Phase 40 Decision 7 (TFP-173): page types found, covered and skipped; present when the pages came from a crawl. */
    pageTypes?: PageTypeCoverageRecord;
    /** Phase 42 (TFP-190): what the site's saved suite gave this run; absent when none was used. */
    siteSuite?: SiteSuiteRecord;
}

export interface PageInspectionRecord {
    /** "inspected": page data was gathered automatically; "failed": generated without it, for `reason`. */
    status: "inspected" | "failed";
    paths: string[];
    /** Pages actually inspected (a path can fail while others succeed). */
    pages: number;
    warnings: string[];
    reason?: string;
}

export interface EmptyAreaRecord {
    area: string;
    /** Why the area has no tests, most specific first. */
    reasons: string[];
}

/** Phase 35 (TFP-134): one item a Comprehensive test recorded, with its own category. */
export interface ComprehensiveIssueRecord {
    kind: "failure" | "finding" | "manual-review";
    category: string;
    detail: string;
}

/** Phase 35 (TFP-132, Decision 7): one row of a Comprehensive run's per-page table. */
export interface ComprehensivePageRow {
    path: string;
    tests: number;
    passed: number;
    failed: number;
    notRun: number;
    findings: number;
}

/** A failure or finding, naming the page and the test (and so the element). */
export interface ComprehensiveIssue {
    page: string;
    title: string;
    detail: string;
}

/** Failures and findings under one OWASP Top 10 category or WCAG criterion. */
export interface ComprehensiveGroup {
    category: string;
    failures: ComprehensiveIssue[];
    findings: ComprehensiveIssue[];
}

/** A test the local model wrote: shown, never counted. */
export interface ComprehensiveModelTest {
    title: string;
    /** "passed", "failed: needs review" (never a defect in the site), or "not run". */
    outcome: "passed" | "failed: needs review" | "not run";
    detail: string;
}

/** Phase 42 (TFP-195): the pool candidates bound to this site and run outside the verdict. */
export interface ComprehensiveCandidateSection {
    note: string;
    tests: Array<{ title: string; outcome: "passed" | "failed: needs review" | "not run"; detail: string }>;
}

export interface ComprehensiveModelSection {
    /** not-configured: no local model; rejected: asked, but its suite fell back; added: its tests are below. */
    status: "not-configured" | "rejected" | "added";
    model?: string;
    note: string;
    tests: ComprehensiveModelTest[];
}

export interface ComprehensiveAsvsRow {
    id: string;
    name: string;
    passiveReach: "in reach" | "out of reach";
    why: string;
    /** From the ASVS tags on checks that actually ran in this run. */
    testedInRun: boolean;
}

export interface ComprehensiveReport {
    area: "security" | "accessibility";
    level: "passive" | null;
    /** e.g. "Comprehensive security (passive)". */
    label: string;
    pageCap: number;
    pagesCovered: string[];
    pagesNotCovered: string[];
    /** Playwright workers the run used, and why (Decision 2). */
    workerCount: number | null;
    workerNote: string;
    summary: {
        pages: number;
        tests: number;
        passed: number;
        failed: number;
        notRun: number;
        findings: number;
        /** One line: what the run found, never "the area is fine". */
        headline: string;
    };
    pages: ComprehensivePageRow[];
    groups: ComprehensiveGroup[];
    /**
     * Decision 4 (TFP-134): what the scan could not decide - listed for a
     * person to review, never counted as passed.
     */
    manualReview: ComprehensiveIssue[];
    /** Decision 5 (TFP-135): the local model's scenarios, outside the verdict. */
    model: ComprehensiveModelSection;
    /** TFP-195: present when candidates ran. */
    candidates?: ComprehensiveCandidateSection;
    /** Decision 6: the fixed statement of what this run did not test. */
    notTested: {
        statements: string[];
        pagesNotCovered: string | null;
        asvs: { source: string; chapters: ComprehensiveAsvsRow[] } | null;
    };
}
