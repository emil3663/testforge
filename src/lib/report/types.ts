export type ExecutionStatus = "Passed" | "Failed" | "Blocked" | "Flaky";
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
