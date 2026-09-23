/**
 * Tests for Phase 17 Groups 2+3 (honest coverage / "not tested, and why" -
 * TFP-071/072), docs/decisions/phase-17-run-persistence-decision-record.md.
 *
 * The properties that matter, straight from the decision record's own
 * acceptance criteria:
 * - A target with more discovered elements than written tests shows a
 *   coverage percentage below 100% even when every written test passes.
 * - The uncovered list names specific discovered elements, not just area
 *   labels.
 * - Every not-tested element carries exactly one reason, and the
 *   generator-gap bucket is real (non-empty on a realistic target), not
 *   vacuous by construction.
 *
 * Requires the "@/" alias resolution discovered-coverage.ts uses at
 * runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/discovered-coverage.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { buildAccessibilityElementTitle, buildActionableElementTitle } from "@/lib/generate/mock/locators";
import { buildDependencyFailureTitle } from "@/lib/generate/mock/dependency-failure-injection";
import type { ActionableElementDetail, ContentProfile, DependencyMapEntry } from "@/lib/generate/mock/types";
import type { ExecutionRecord } from "./types";
import { computeDiscoveredElementCoverage, buildDiscoveredCoverageMatrix } from "./discovered-coverage";

function element(overrides: Partial<ActionableElementDetail> = {}): ActionableElementDetail {
    return {
        text: "Save",
        url: null,
        category: "form",
        elementType: "button",
        containerLabel: "Toolbar",
        expectedStatus: null,
        isVisible: true,
        ariaPressed: null,
        ariaSelected: null,
        ariaChecked: null,
        ariaExpanded: null,
        groupId: null,
        locator: { role: "button", name: "Save", label: "", placeholder: "", id: "", inputType: "" },
        ...overrides,
    };
}

function executionRecord(title: string, status: ExecutionRecord["status"] = "Passed"): ExecutionRecord {
    return {
        id: randomUUID(),
        title,
        description: "",
        suite: "Functional Coverage",
        area: "Functional",
        interactionType: null,
        browser: "chromium",
        status,
        duration: 10,
        remarks: "",
        rawMessage: "",
        reproductionSteps: [],
        artifacts: [],
        order: 0,
    };
}

const BASE_URL = "https://discovered-coverage-test.example";

test("Group 2: more discovered elements than tests still shows <100% coverage even when every written test passes", () => {
    const savedElement = element({ text: "Save", containerLabel: "Toolbar" });
    const discardElement = element({ text: "Discard", category: "action", locator: { role: "button", name: "Discard", label: "", placeholder: "", id: "", inputType: "" } });
    const contentProfile: ContentProfile = {
        scannedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pages: [{
            path: "/",
            url: BASE_URL,
            title: "Home",
            metaDescription: "",
            headings: [],
            buttons: [],
            links: [],
            actionableElements: [savedElement, discardElement],
            linkDetails: [],
            visibleTextSnippets: [],
        }],
    };

    // Only "Save" got a matching executed test, and it passed - "Discard" has none.
    const records: ExecutionRecord[] = [executionRecord(buildActionableElementTitle(savedElement), "Passed")];

    const { matches } = computeDiscoveredElementCoverage(["functional"], contentProfile, records, BASE_URL);
    const coverage = buildDiscoveredCoverageMatrix(["functional"], records, matches);

    const functionalRow = coverage.matrix.find((item) => item.requirement === "Functional");
    assert.ok(functionalRow, "functional row must exist");
    assert.equal(functionalRow!.status, "partial", "1 of 2 discovered elements tested is partial, not covered");
    assert.equal(functionalRow!.percentage, 50, "50% of discovered elements (1 of 2) have a matching test");
    assert.ok(coverage.percentage < 100, "overall coverage percentage must be below 100%");
    assert.deepEqual(functionalRow!.uncoveredElements, ["Discard"], "uncovered list must name the specific untested element");
    assert.ok(
        coverage.uncovered.some((entry) => entry.includes("Discard")),
        "top-level uncovered list must name the specific element, not just the area label"
    );
});

test("Group 3: not-selected, excluded-by-generator (link + cap), and generator-gap are each exactly one reason", () => {
    const dedicatedLinkElement = element({
        text: "GitHub",
        elementType: "link",
        url: "https://github.com/example/example",
        locator: { role: "link", name: "GitHub", label: "", placeholder: "", id: "", inputType: "" },
    });
    const gapElement = element({ text: "Untested Button", locator: { role: "button", name: "Untested Button", label: "", placeholder: "", id: "", inputType: "" } });
    const capElements = Array.from({ length: 51 }, (_, index) =>
        element({ text: `Cap Button ${index}`, locator: { role: "button", name: `Cap Button ${index}`, label: "", placeholder: "", id: "", inputType: "" } })
    );

    const contentProfile: ContentProfile = {
        scannedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pages: [{
            path: "/",
            url: BASE_URL,
            title: "Home",
            metaDescription: "",
            headings: [],
            buttons: [],
            links: [],
            // dedicatedLinkElement first so it doesn't shift the cap math;
            // gapElement and 51 cap elements after it (52 candidates total
            // after the link is filtered out - the 51st and 52nd fall
            // beyond the 50-cap).
            actionableElements: [dedicatedLinkElement, gapElement, ...capElements],
            linkDetails: [{
                text: "GitHub", url: "https://github.com/example/example", rawHref: "https://github.com/example/example",
                category: "navigation", linkType: "external", containerLabel: "", expectedStatus: null, isVisible: true,
                target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: true,
            }],
            visibleTextSnippets: [],
        }],
    };

    // Nothing executed at all this run - isolates the reason bucketing itself.
    const records: ExecutionRecord[] = [];

    const { notTested } = computeDiscoveredElementCoverage(["functional"], contentProfile, records, BASE_URL);

    // Exactly one reason per element - no element appears under two reasons.
    const byElement = new Map<string, string[]>();
    for (const entry of notTested) {
        const key = `${entry.area}::${entry.path}::${entry.elementName}::${entry.elementType}`;
        byElement.set(key, [...(byElement.get(key) ?? []), entry.reason]);
    }
    for (const [key, reasons] of byElement) {
        assert.equal(reasons.length, 1, `${key} must carry exactly one reason, got ${JSON.stringify(reasons)}`);
    }

    const linkExclusion = notTested.find((entry) => entry.elementName === "GitHub");
    assert.ok(linkExclusion, "the dedicated-link-details element must appear in notTested");
    assert.equal(linkExclusion!.reason, "excluded-by-generator");
    assert.match(linkExclusion!.reasonDetail, /dedicated link-audit/);

    const capExcluded = notTested.filter((entry) => entry.elementName.startsWith("Cap Button") && entry.reason === "excluded-by-generator");
    assert.ok(capExcluded.length > 0, "elements beyond the generator's 50-element cap must be excluded-by-generator, not generator-gap");

    const generatorGap = notTested.find((entry) => entry.elementName === "Untested Button");
    assert.ok(generatorGap, "the honestly-untested element must appear in notTested");
    assert.equal(generatorGap!.reason, "generator-gap", "an element with no known exclusion and no matching test must land in generator-gap, not be silently absorbed elsewhere");

    // Group 3's own acceptance bar: the generator-gap bucket must be
    // non-empty by real construction, not vacuous.
    const generatorGapEntries = notTested.filter((entry) => entry.reason === "generator-gap");
    assert.ok(generatorGapEntries.length > 0, "generator-gap bucket must be demonstrably non-empty");
});

test("Group 3: an unselected practice area buckets all of its discovered elements as not-selected", () => {
    const accessibilityElement = element({ text: "Menu toggle", elementType: "button" });
    const contentProfile: ContentProfile = {
        scannedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pages: [{
            path: "/",
            url: BASE_URL,
            title: "Home",
            metaDescription: "",
            headings: [],
            buttons: [],
            links: [],
            actionableElements: [accessibilityElement],
            linkDetails: [],
            visibleTextSnippets: [],
        }],
    };

    // "accessibility" deliberately not in selectedPractices.
    const { notTested, matches } = computeDiscoveredElementCoverage(["functional"], contentProfile, [], BASE_URL);

    const accessibilityEntries = notTested.filter((entry) => entry.area === "accessibility");
    assert.ok(accessibilityEntries.length > 0, "accessibility elements must still be reported");
    assert.ok(accessibilityEntries.every((entry) => entry.reason === "not-selected"), "every accessibility element must be not-selected when the area wasn't chosen");
    assert.ok(!matches.some((match) => match.area === "accessibility"), "an unselected area must not produce match attempts at all");
});

test("Group 2: accessibility coverage matches by its own title shape, independent of functional", () => {
    const target = element({ text: "Menu toggle", elementType: "button", isVisible: true });
    const contentProfile: ContentProfile = {
        scannedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pages: [{
            path: "/",
            url: BASE_URL,
            title: "Home",
            metaDescription: "",
            headings: [],
            buttons: [],
            links: [],
            actionableElements: [target],
            linkDetails: [],
            visibleTextSnippets: [],
        }],
    };
    const records: ExecutionRecord[] = [executionRecord(buildAccessibilityElementTitle(target), "Passed")];

    const { matches } = computeDiscoveredElementCoverage(["accessibility"], contentProfile, records, BASE_URL);
    const coverage = buildDiscoveredCoverageMatrix(["accessibility"], records, matches);

    const accessibilityRow = coverage.matrix.find((item) => item.requirement === "Accessibility");
    assert.ok(accessibilityRow);
    assert.equal(accessibilityRow!.status, "covered");
    assert.equal(accessibilityRow!.percentage, 100);
});

test("areas without discovered-element data keep the prior test-based rollup unchanged", () => {
    const records: ExecutionRecord[] = [
        { ...executionRecord("captures a simple load-time budget for the landing page", "Passed"), area: "Performance" },
    ];

    const { matches } = computeDiscoveredElementCoverage(["performance/load"], null, records, BASE_URL);
    const coverage = buildDiscoveredCoverageMatrix(["performance/load"], records, matches);

    const performanceRow = coverage.matrix.find((item) => item.requirement === "Performance");
    assert.ok(performanceRow);
    assert.equal(performanceRow!.status, "covered", "old test-based rollup must still classify a fully-passing area as covered");
    assert.equal(performanceRow!.uncoveredElements, undefined, "an area with no discovered-element data must not claim an element-level uncovered list");
});

function dependencyEntry(overrides: Partial<DependencyMapEntry> = {}): DependencyMapEntry {
    return {
        host: "cdn.example.net",
        kind: "third-party-script",
        sampleUrl: "https://cdn.example.net/analytics.js",
        sameOrigin: false,
        method: null,
        rawValue: null,
        occurrences: 1,
        paths: ["/"],
        ...overrides,
    };
}

test("TFP-085: reliability folds into the same discovered-coverage denominator as functional/accessibility", () => {
    const blockedScript = dependencyEntry({ host: "cdn.example.net", kind: "third-party-script" });
    const blockedApi = dependencyEntry({ host: "api.example.net", kind: "xhr-fetch", sampleUrl: "https://api.example.net/data" });
    const contentProfile: ContentProfile = {
        scannedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pages: [{
            path: "/", url: BASE_URL, title: "Home", metaDescription: "", headings: [], buttons: [], links: [],
            actionableElements: [], linkDetails: [], visibleTextSnippets: [],
        }],
        dependencyMap: [blockedScript, blockedApi],
    };
    // Only the script's failure-injection test actually ran.
    const records: ExecutionRecord[] = [executionRecord(buildDependencyFailureTitle(blockedScript), "Passed")];

    const { matches, notTested } = computeDiscoveredElementCoverage(["reliability"], contentProfile, records, BASE_URL);
    const coverage = buildDiscoveredCoverageMatrix(["reliability"], records, matches);

    const reliabilityRow = coverage.matrix.find((item) => item.requirement === "Reliability");
    assert.ok(reliabilityRow, "reliability row must exist, the same way functional/accessibility rows do");
    assert.equal(reliabilityRow!.status, "partial", "1 of 2 recorded dependencies tested is partial, not covered");
    assert.deepEqual(reliabilityRow!.uncoveredElements, ["api.example.net [xhr-fetch]"]);
    assert.ok(
        notTested.some((item) => item.area === "reliability" && item.reason === "generator-gap" && item.elementName.includes("api.example.net")),
        "the untested dependency must be bucketed generator-gap, not silently absorbed"
    );
});

test("TFP-085: a cookie-kind dependency is excluded-by-generator, not a false generator-gap", () => {
    const cookie = dependencyEntry({ host: "app.example.net", kind: "cookie", sampleUrl: "session_id" });
    const contentProfile: ContentProfile = {
        scannedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        pages: [{
            path: "/", url: BASE_URL, title: "Home", metaDescription: "", headings: [], buttons: [], links: [],
            actionableElements: [], linkDetails: [], visibleTextSnippets: [],
        }],
        dependencyMap: [cookie],
    };

    const { matches, notTested } = computeDiscoveredElementCoverage(["reliability"], contentProfile, [], BASE_URL);

    assert.equal(matches.length, 0, "a cookie-kind dependency has no generated test, so it must never appear as a match");
    assert.equal(notTested.length, 1);
    assert.equal(notTested[0]!.reason, "excluded-by-generator");
});
