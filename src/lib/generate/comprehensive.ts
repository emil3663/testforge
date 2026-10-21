import type { ComprehensivePageScope } from "@/lib/comprehensive/pages";
import { comprehensiveLabel, type ComprehensiveArea, type ComprehensiveRunMode } from "@/lib/comprehensive/run-mode";
import type { CheckStandard } from "@/lib/comprehensive/standards";
import { PASSIVE_SECURITY_HELPERS } from "./comprehensive-security-helpers";
import { checkDetails, PAGE_ANNOTATION, passiveSecurityPageTests, passiveSecurityRunTests, PROBE_PAGE } from "./comprehensive-security";
import { ACCESSIBILITY_HELPERS, accessibilityPageTests } from "./comprehensive-accessibility";
import { guessableIdsTest, knownPathsTest, PROBE_HELPERS, PROBE_STANDARDS } from "./security-probes";
import { apiFieldsTest } from "./api-fields";
import { entryApplies } from "@/lib/library/entries";
import { escapeForSingleQuotedString } from "./mock/format";
import { localModelSuiteTitle } from "./gap-fill";
import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import { ACTIVE_GATE_SKIP, gateDetails, type TestGate } from "@/lib/run/test-gates";
import { SUITE_AREA_CODES, SUITE_TITLES } from "./mock/suite";
import { routeAddedVisits, routePageVisits } from "./page-visits";
import { shareReadOnlyVisits, type ShareOptions } from "./shared-visits";

// Phase 35 (TFP-132, Decisions 1, 2 and 7): the suite a Comprehensive run
// executes. Separate from the Standard generator on purpose: a Standard
// run's suite is unchanged (Decision 1), and the Standard security suite
// submits script payloads to forms, which the passive level must never do
// (Decision 3). One describe per covered page, nested in the area's usual
// suite title so the report files every test under that area; every test is
// tagged with its page (a `page` annotation) for the per-page table, and with
// its OWASP/WCAG `category` and ASVS requirements where they apply.
//
// The suite runs its tests one at a time in a single worker by itself
// (TFP-133, added at Gate A): the one-worker rule of Decision 2 must not
// depend on the caller sending runMode, or on the host the request named.

export { PAGE_ANNOTATION };

export interface PageCheckContext {
    path: string;
    /** The path, escaped for a single-quoted string in generated code. */
    escapedPath: string;
    /** `{ annotation: [...] }`: the page and the read-only gate, plus a standard's tags when given. */
    details: (standard?: CheckStandard) => string;
}

type PageCheck = (context: PageCheckContext) => string[];

const detailsFor = checkDetails;

export const PAGE_CHECKS: Record<ComprehensiveArea, PageCheck[]> = {
    // TFP-133: the passive checks; "the page responds" is the first of them.
    security: [
        ({ escapedPath, details }) => passiveSecurityPageTests({ escapedPath, details: (standard) => details(standard) }),
        // Phase 41 (TFP-184): integer ids counting up in the page's addresses, as a finding.
        // Phase 42 (TFP-193): library entries; a Comprehensive page is known by its path, so an entry for any page applies.
        ({ escapedPath, details }) => (entryApplies("probes.guessable-ids", undefined) ? [guessableIdsTest({ escapedPath, details: (standard) => details(standard) })] : []),
        // Phase 41 (TFP-185): fields with internal-sounding names that the page's API responses carry and it never shows, as a finding.
        ({ escapedPath, details }) => (entryApplies("api.internal-fields", undefined) ? [apiFieldsTest({ escapedPath, details: (standard) => details(standard) })] : []),
    ],
    // TFP-134: the axe-core WCAG scan, then TFP-121's field-name check.
    accessibility: [({ path, escapedPath, details }) =>
        accessibilityPageTests({ path, escapedPath, details: (category) => details({ category, asvs: [], why: "" }) })],
};

/** Checks made once per run, not per page, each in its own describe. */
const RUN_CHECKS: Record<ComprehensiveArea, { title: string; tests: (scope: ComprehensivePageScope) => string[] }[]> = {
    security: [
        { title: "Missing page probe", tests: () => passiveSecurityRunTests((standard) => detailsFor(PROBE_PAGE)(standard)) },
        // Phase 41 (TFP-184, Decision 5): the known paths, from the run's first page.
        { title: "Known path probe", tests: (scope) => (!entryApplies("probes.known-paths", undefined) ? [] : [knownPathsTest(detailsFor(KNOWN_PATHS_PAGE)(PROBE_STANDARDS.knownPaths), escapeForSingleQuotedString(scope.covered[0] ?? "/"))]) },
    ],
    accessibility: [],
};

/** The page the known-path probe reports under, in the per-page table. */
export const KNOWN_PATHS_PAGE = "(known-path probe)";

const HELPERS: Record<ComprehensiveArea, string> = {
    security: PASSIVE_SECURITY_HELPERS + PROBE_HELPERS,
    accessibility: ACCESSIBILITY_HELPERS,
};

/**
 * Phase 35 (TFP-135, Decision 5): why the local model's scenarios in a
 * Comprehensive run are not run, or run only on request. A passive security
 * run sends no input (Decision 3), and a model-written test may - submitting
 * a form or attack-shaped input is the active level, which needs Decision 8's
 * permission - so there they are listed and never run. In other areas they
 * may still submit forms, so they run only with interactive tests on.
 *
 * Phase 38 (TFP-146, decided by Emil 2026-10-05): in a security run they sit
 * at the active gate, closed until the ownership confirmation exists, with
 * that gate's reason; elsewhere at the interactive gate (Decision 3).
 */
export function scenarioGate(mode: ComprehensiveRunMode): TestGate {
    return mode.area === "security" ? "active" : "interactive";
}

export function scenarioSkip(mode: ComprehensiveRunMode, model: string): string {
    return scenarioGate(mode) === "active"
        ? ACTIVE_GATE_SKIP
        : `test.skip(process.env.${INTERACTIVE_ENV_VAR} !== '1', '${escapeForSingleQuotedString(`written by the local model (${model}): it may submit forms on the live site, so it runs only when ${INTERACTIVE_ENV_VAR}=1 is set for the run`)}');`;
}

/**
 * Appends the local model's scenarios to a Comprehensive suite, in their own
 * describe titled as Option B's ("Local model (<model>)"), so the report
 * knows them as the model's and keeps them outside the verdict.
 */
export function mergeComprehensiveScenarios(suiteCode: string, localCode: string, model: string, mode: ComprehensiveRunMode): string {
    const body = localCode
        .split("\n")
        .filter((line) => !/^\s*import\s+[^;]*from\s+['"]@playwright\/test['"];?\s*$/.test(line))
        .map((line) => (line.trim() === "" ? "" : `    ${line}`))
        .join("\n")
        .trim();
    // TFP-168: the scenarios' page visits go through tfGoto, defined once: the suite's, or added here before the block.
    const routed = routeAddedVisits(suiteCode, body);
    return `${suiteCode}${routed.helper}
// Written by the local model (${model}): site-specific ${mode.area} scenarios,
// shown in their own report section and kept outside the verdict (Phase 35
// Decision 5).
test.describe('${escapeForSingleQuotedString(localModelSuiteTitle(model))}', ${gateDetails(scenarioGate(mode))}, () => {
    ${scenarioSkip(mode, model)}

    ${routed.code}
});
`;
}

export function buildComprehensiveSuite(baseUrl: string, mode: ComprehensiveRunMode, scope: ComprehensivePageScope, options: { sharedVisits?: boolean } & ShareOptions = {}): string {
    const areaCode = SUITE_AREA_CODES[mode.area];
    let lastId = 0;
    const numbered = (tests: string[]) =>
        tests.map((testSource) => testSource.replace(/^(\s*test\(['"])/, (match) => `${match}TF${areaCode}-${String(++lastId).padStart(3, "0")}: `));

    const pageBlocks = scope.covered.map((path) => {
        const escapedPath = escapeForSingleQuotedString(path);
        const context: PageCheckContext = { path, escapedPath, details: detailsFor(escapedPath) };
        const tests = numbered(PAGE_CHECKS[mode.area].flatMap((check) => check(context)));
        return `  test.describe('Page ${escapedPath}', () => {\n${tests.join("\n\n")}\n  });`;
    });
    const runBlocks = RUN_CHECKS[mode.area].map(({ title, tests }) => `  test.describe('${title}', () => {\n${numbered(tests(scope)).join("\n\n")}\n  });`);

    const notCovered = scope.notCovered.length > 0
        ? `// Not covered (beyond the ${scope.pageCap}-page cap): ${scope.notCovered.join(", ")}\n`
        : "";
    const helpers = HELPERS[mode.area] ? `\n${HELPERS[mode.area]}` : "";
    // TFP-167: every page visit waits for the page to draw. TFP-212: each page's checks share one visit (off only to
    // prove Decision 7); axeOrder is TFP-214's switch for where the axe scan runs.
    const share = options.sharedVisits === false ? (suite: string) => suite : (suite: string) => shareReadOnlyVisits(suite, { axeOrder: options.axeOrder });
    return share(routePageVisits(`import { test, expect } from '@playwright/test';

// Generated by TestForge: ${comprehensiveLabel(mode)} run.
// Pages covered (${scope.covered.length}, cap ${scope.pageCap}): ${scope.covered.join(", ")}
${notCovered}
test.use({ baseURL: '${escapeForSingleQuotedString(baseUrl)}' });

// One test at a time, in one worker, whatever the run's settings: this run
// must not load someone's site like an attack would (Phase 35 Decision 2).
test.describe.configure({ mode: 'default' });
${helpers}
test.describe('${SUITE_TITLES[mode.area]}', () => {
${[...pageBlocks, ...runBlocks].join("\n\n")}
});
`));
}
