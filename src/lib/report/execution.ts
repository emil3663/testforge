import { normalizeExecutionTitle, sanitizeDiagnosticText, simplifyExecutionTarget, classifyFailureReason } from "./text";
import { createExecutionArtifacts } from "./artifacts";
import { LOCAL_MODEL_SUITE_PREFIX } from "@/lib/generate/gap-fill";
import { CANDIDATE_DESCRIBE } from "@/lib/candidates/constants";
import { GATE_ANNOTATION, isTestGate } from "@/lib/run/test-gates";
import type {
    ComprehensiveIssueRecord,
    ExecutionRecord,
    ExecutionStatus,
    JsonSuite,
    JsonTest,
    JsonTestResult,
} from "./types";

export const AREA_LABELS: Record<string, string> = {
    functional: "Functional",
    "responsive/mobile": "Responsive",
    "performance/load": "Performance",
    security: "Security",
    accessibility: "Accessibility",
    usability: "Usability",
    "seo/content": "SEO",
    "cookie/session": "Cookies",
    database: "Database",
    reliability: "Reliability",
};

export const SUITE_AREA_MAP: Record<string, string> = {
    "Functional Coverage": "functional",
    "Responsive Coverage": "responsive/mobile",
    "Performance Coverage": "performance/load",
    "Security Coverage": "security",
    "Accessibility Coverage": "accessibility",
    "Usability Coverage": "usability",
    "SEO and Content Coverage": "seo/content",
    "Cookie and Session Coverage": "cookie/session",
    "Database Coverage": "database",
    "Reliability Coverage": "reliability",
};

export function mapStatus(testStatus: JsonTest["status"]): ExecutionStatus {
    if (testStatus === "unexpected") {
        return "Failed";
    }

    if (testStatus === "flaky") {
        return "Flaky";
    }

    if (testStatus === "skipped") {
        return "Blocked";
    }

    return "Passed";
}

// Phase 21 (TFP-098): model-written suites follow SYSTEM_PROMPT's "test.describe
// blocks named after each coverage area" and name them "Accessibility",
// "Performance/Load", "SEO/Content"... - never the template generator's
// "... Coverage" suite names above. Without this every model-written test was
// filed as Functional, which made per-area reporting (and any comparison
// against the template generator) meaningless. Exact, case-insensitive match
// of a whole describe title against an area key or label only - never a
// substring, so a describe named "Login security notes" stays Functional.
const AREA_NAME_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(AREA_LABELS).flatMap(([key, label]) => [
        [key.toLowerCase(), key],
        [label.toLowerCase(), key],
    ])
);

function areaForSuiteTitle(title: string): string | undefined {
    return SUITE_AREA_MAP[title] ?? AREA_NAME_MAP[title.trim().toLowerCase()];
}

export function deriveArea(pathTitles: string[]) {
    const matchedSuite = pathTitles.find((title) => areaForSuiteTitle(title));
    const area = matchedSuite ? areaForSuiteTitle(matchedSuite)! : "functional";
    return {
        key: area,
        label: AREA_LABELS[area] ?? "Functional",
    };
}

export function deriveInteractionType(title: string) {
    if (/^navigation link health:/i.test(title) || /^navigation element check:/i.test(title)) {
        return "Navigation" as const;
    }

    if (/^api link response:/i.test(title) || /^api element check:/i.test(title)) {
        return "API" as const;
    }

    if (/^form element check:/i.test(title)) {
        return "Form" as const;
    }

    if (/^action element check:/i.test(title)) {
        return "Action" as const;
    }

    return null;
}

export function buildExecutionDescription(
    title: string,
    interactionType: "Navigation" | "API" | "Form" | "Action" | null,
) {
    const normalizedTitle = normalizeExecutionTitle(title);

    if (/link protocols are safe and do not expose obvious xss vectors/i.test(title)) {
        return "Expected result: links should use safe protocols only and should not expose javascript: or other obvious XSS-style vectors.";
    }

    if (/do not return broken responses/i.test(title)) {
        return "Expected result: every checked link should return a healthy response rather than a broken HTTP result.";
    }

    if (/navigate to their required destination/i.test(title)) {
        return "Expected result: each tested link should open the correct destination without sending the user to the wrong page.";
    }

    if (/classified correctly/i.test(title)) {
        return "Expected result: each tested link should be correctly identified as internal, external, anchor, mailto, or download.";
    }

    if (/mailto links expose the correct recipient/i.test(title)) {
        return "Expected result: each mailto link should point to the correct recipient address.";
    }

    if (/download links can be requested successfully/i.test(title)) {
        return "Expected result: each download link should point to a real downloadable resource that responds successfully.";
    }

    if (/protected links redirect or block unauthorized access/i.test(title)) {
        return "Expected result: protected links should redirect unauthenticated users to login or return an appropriate access-denied response.";
    }

    if (/shows visible content/i.test(title)) {
        return "Expected result: the page should load successfully and show visible content to the user.";
    }

    if (/interactive element/i.test(title)) {
        return "Expected result: the page should expose at least one visible interactive element related to the selected flow.";
    }

    if (interactionType) {
        return `Expected result: the ${interactionType.toLowerCase()} behavior for ${normalizedTitle} should complete successfully.`;
    }

    return `Expected result: ${normalizedTitle} should complete successfully.`;
}

export function extractNamedFailures(rawMessage: string, prefix: string) {
    const matches = [...rawMessage.matchAll(new RegExp(`${prefix}([^\n\r]+)`, "gi"))]
        .map((match) => sanitizeDiagnosticText(match[1] ?? ""))
        .filter((value) => value.length > 0);

    return [...new Set(matches)];
}

export function buildExecutionOutcomeSummary(
    title: string,
    status: ExecutionStatus,
    rawMessage: string,
    skipReason: string | null = null
) {
    const simplifiedTitle = simplifyExecutionTarget(title);
    const brokenLinks = extractNamedFailures(rawMessage, "Broken link detected for ");
    const unsafeLinks = [
        ...extractNamedFailures(rawMessage, "Unsafe link protocol detected for "),
        ...extractNamedFailures(rawMessage, "Unsafe data protocol detected for "),
        ...extractNamedFailures(rawMessage, "Suspicious link text detected for "),
    ];
    const uniqueUnsafeLinks = [...new Set(unsafeLinks)];

    if (status === "Passed") {
        if (/link protocols are safe and do not expose obvious xss vectors/i.test(title)) {
            return "Passed. No unsafe link protocols or obvious XSS-style href patterns were detected in the checked links.";
        }

        if (/do not return broken responses/i.test(title)) {
            return "Passed. The checked links returned healthy responses and did not show broken-link behavior.";
        }

        if (/navigate to their required destination/i.test(title)) {
            return "Passed. The tested links opened the expected destinations.";
        }

        return `Passed. ${simplifiedTitle} behaved as expected.`;
    }

    if (status === "Flaky") {
        return `Passed after retry. ${simplifiedTitle} did not succeed on the first attempt, so this behavior should be monitored for instability.`;
    }

    // Phase 34 (TFP-117, Option C): a test that skipped itself on purpose
    // (e.g. a form-submitting test with interactive tests off) says why,
    // instead of being reported as an interrupted run.
    if (status === "Not run") {
        return `Not run. ${simplifiedTitle} did not run: ${skipReason ?? "it skipped itself"}.`;
    }

    if (status === "Blocked") {
        return `Blocked. ${simplifiedTitle} could not be completed because the run was interrupted or a required dependency was unavailable.`;
    }

    if (/link protocols are safe and do not expose obvious xss vectors/i.test(title)) {
        return uniqueUnsafeLinks.length > 0
            ? `Failed. Unsafe link patterns were detected for: ${uniqueUnsafeLinks.join(", ")}.`
            : "Failed. At least one checked link used an unsafe protocol or href pattern that could expose a client-side security risk, such as a javascript: style target.";
    }

    if (/do not return broken responses/i.test(title)) {
        return brokenLinks.length > 0
            ? `Failed. Broken links were detected for: ${brokenLinks.join(", ")}.`
            : "Failed. One or more checked links returned an unhealthy HTTP response and appear to be broken.";
    }

    if (/navigate to their required destination/i.test(title)) {
        return "Failed. At least one tested link did not open the expected destination.";
    }

    if (/classified correctly/i.test(title)) {
        return "Failed. At least one link was detected with the wrong link type or an unexpected href pattern.";
    }

    if (/mailto links expose the correct recipient/i.test(title)) {
        return "Failed. At least one mailto link did not expose the expected recipient address.";
    }

    if (/download links can be requested successfully/i.test(title)) {
        return "Failed. At least one download link did not return a successful downloadable response.";
    }

    if (/protected links redirect or block unauthorized access/i.test(title)) {
        return "Failed. At least one protected link did not redirect or block unauthenticated access as expected.";
    }

    return `Failed. ${simplifiedTitle} did not meet the expected result because ${classifyFailureReason(rawMessage)}.`;
}

export function buildExecutionSteps(
    title: string,
    suiteName: string,
    browserName: string,
    message: string,
    interactionType: "Navigation" | "API" | "Form" | "Action" | null
) {
    if (interactionType) {
        return [
            `Reused the active ${browserName} session for generated ${suiteName} checks.`,
            `Executed the ${interactionType.toLowerCase()} element check for ${normalizeExecutionTitle(title)}.`,
            `Validated the observed outcome: ${message.split("\n")[0]}.`,
        ];
    }

    return [
        `Reused the active ${browserName} session for generated ${suiteName} checks.`,
        `Executed the test case: ${title}.`,
        `Validated the observed outcome: ${message.split("\n")[0]}.`,
    ];
}

export function extractMessage(result: JsonTestResult) {
    return sanitizeDiagnosticText(
        result.error?.message ??
        result.errors.find((error) => error.message)?.message ??
        "No additional diagnostics captured."
    );
}

// Phase 34 (TFP-116): what a test recorded without failing - e.g. "no
// Content-Security-Policy header". Playwright keeps runtime annotations on the
// test, so they arrive here with the result.
function findingsOf(test: JsonTest): string[] {
    const found = (test.annotations ?? [])
        .filter((annotation) => annotation.type === "finding" && annotation.description)
        .map((annotation) => annotation.description!.trim());
    return [...new Set(found)];
}

// Phase 35 (TFP-132): a Comprehensive test's page, its OWASP/WCAG group and
// its ASVS requirement IDs, from static annotations. Standard tests carry
// none, so their records don't change.
function annotationValues(test: JsonTest, type: string): string[] {
    return [...new Set((test.annotations ?? []).filter((a) => a.type === type && a.description).map((a) => a.description!.trim()))];
}

const ISSUE_KINDS = new Set(["failure", "finding", "manual-review"]);

/** TFP-134: `issue` annotations, JSON { kind, category, detail }; anything else is ignored. */
function issuesOf(test: JsonTest): ComprehensiveIssueRecord[] {
    return annotationValues(test, "issue").flatMap((description) => {
        try {
            const value = JSON.parse(description) as Record<string, unknown>;
            return ISSUE_KINDS.has(value.kind as string) && typeof value.category === "string" && typeof value.detail === "string"
                ? [{ kind: value.kind as ComprehensiveIssueRecord["kind"], category: value.category, detail: value.detail }]
                : [];
        } catch {
            return [];
        }
    });
}

function comprehensiveTags(test: JsonTest): Pick<ExecutionRecord, "page" | "category" | "asvs" | "issues"> {
    const [page] = annotationValues(test, "page");
    const [category] = annotationValues(test, "category");
    const asvs = annotationValues(test, "asvs");
    const issues = issuesOf(test);
    return { ...(page ? { page } : {}), ...(category ? { category } : {}), ...(asvs.length > 0 ? { asvs } : {}), ...(issues.length > 0 ? { issues } : {}) };
}

// Phase 38 Decision 1: the gate a test declared, on itself or on its describe.
function gateOf(test: JsonTest): Pick<ExecutionRecord, "gate"> {
    const [gate] = annotationValues(test, GATE_ANNOTATION);
    return isTestGate(gate) ? { gate } : {};
}

function withGenerator(remark: string, localModel: string | null) {
    return localModel ? `${remark} Written by the local model (${localModel}).` : remark;
}

function withFindings(remark: string, findings: string[]) {
    return findings.length > 0 ? `${remark} Findings: ${findings.join("; ")}.` : remark;
}

// Phase 38 (TFP-149): a value recorded with no pass or fail, e.g. TBT.
function measurementsOf(test: JsonTest): string[] {
    return annotationValues(test, "measurement");
}

function withMeasurements(remark: string, measurements: string[]) {
    return measurements.length > 0 ? `${remark} Measured: ${measurements.join("; ")}` : remark;
}

export function flattenSuites(
    suites: JsonSuite[],
    lineage: string[] = [],
    orderRef: { value: number } = { value: 0 }
): ExecutionRecord[] {
    const records: ExecutionRecord[] = [];

    for (const suite of suites) {
        const nextLineage = suite.title ? [...lineage, suite.title] : lineage;

        // Phase 34 (TFP-118): Option B's appended block, e.g. "Local model (testforge-qwen7b:latest)".
        const localModel = nextLineage.find((title) => title.startsWith(LOCAL_MODEL_SUITE_PREFIX))?.slice(LOCAL_MODEL_SUITE_PREFIX.length, -1) ?? null;

        for (const spec of suite.specs ?? []) {
            const area = deriveArea(nextLineage);
            const suiteName = nextLineage.find((title) => SUITE_AREA_MAP[title]) ?? "General";

            for (const test of spec.tests ?? []) {
                const latestResult = [...(test.results ?? [])].sort(
                    (left, right) => left.retry - right.retry
                ).at(-1);
                const skipReason = test.annotations?.find((annotation) => annotation.type === "skip" && annotation.description)?.description ?? null;
                // Option C: a skip with a stated reason was a choice, not a failure.
                const status: ExecutionStatus = test.status === "skipped" && skipReason ? "Not run" : mapStatus(test.status);
                const message = latestResult ? extractMessage(latestResult) : "No result captured.";
                const interactionType = deriveInteractionType(spec.title);

                orderRef.value += 1;
                records.push({
                    id: spec.id,
                    title: spec.title,
                    description: buildExecutionDescription(
                        spec.title,
                        interactionType,
                    ),
                    suite: suiteName,
                    area: area.label,
                    interactionType,
                    browser: test.projectName || "chromium",
                    status,
                    duration: latestResult?.duration ?? 0,
                    remarks: withGenerator(
                        withMeasurements(
                            withFindings(
                                buildExecutionOutcomeSummary(
                                    spec.title,
                                    status,
                                    message,
                                    skipReason
                                ),
                                findingsOf(test)
                            ),
                            measurementsOf(test)
                        ),
                        localModel
                    ),
                    findings: findingsOf(test),
                    ...(measurementsOf(test).length > 0 ? { measurements: measurementsOf(test) } : {}),
                    // TFP-195: a pool candidate, bound to this site and run outside the verdict.
                    generator: localModel ? "local model" : nextLineage.includes(CANDIDATE_DESCRIBE) ? "candidate" : "template",
                    ...(status === "Not run" && skipReason ? { skipReason } : {}),
                    ...gateOf(test),
                    ...comprehensiveTags(test),
                    rawMessage: message,
                    reproductionSteps: buildExecutionSteps(
                        spec.title,
                        suiteName,
                        test.projectName || "chromium",
                        message,
                        interactionType
                    ),
                    artifacts: createExecutionArtifacts(latestResult, spec.id, test.projectName || "chromium"),
                    order: orderRef.value,
                });
            }
        }

        records.push(...flattenSuites(suite.suites ?? [], nextLineage, orderRef));
    }

    return records;
}
