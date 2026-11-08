import { getActionableElementDisplayName, normalizeRoutePath } from "@/lib/generate/mock/locators";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage } from "@/lib/generate/mock/types";
import type { ExecutionStatus } from "@/lib/report/types";
import { loadRunRecord } from "@/lib/run/persistence";
import { groupPagesByAddress } from "@/lib/selection/page-types";

export interface RunDiffTestStatusChange {
    title: string;
    browser: string;
    from: ExecutionStatus | "not run";
    to: ExecutionStatus | "not run";
}

export interface RunDiffCoverageAreaDelta {
    area: string;
    percentageA: number;
    percentageB: number;
    delta: number;
}

export interface RunDiffElementChange {
    path: string;
    elementName: string;
    elementType: string;
}

export interface RunDiff {
    runIdA: string;
    runIdB: string;
    baseUrl: string;
    testsPassedInAOnly: RunDiffTestStatusChange[];
    testsPassedInBOnly: RunDiffTestStatusChange[];
    coverageDeltas: RunDiffCoverageAreaDelta[];
    elementsNewlyDiscovered: RunDiffElementChange[];
    elementsNewlyMissing: RunDiffElementChange[];
    /** Phase 47 (TFP-246): B's failures against A's, which is what a CI baseline acts on. */
    failures: RunDiffFailures;
}

/** Failing is Failed or Blocked, as the CLI's verdict counts it (TFP-245); Flaky passed, Not run didn't run. */
export interface RunDiffFailures {
    /** Failing in both. */
    known: RunDiffTestStatusChange[];
    /** Failing in B, and passing, not run or absent in A: what fails a build that has a baseline (Decision 5). */
    new: RunDiffTestStatusChange[];
    /** Failing in A, passing in B. */
    fixed: RunDiffTestStatusChange[];
}

export type RunDiffError = "not-found-a" | "not-found-b" | "different-base-url";
export type RunDiffResult = { ok: true; diff: RunDiff } | { ok: false; error: RunDiffError };

function isPassingStatus(status: ExecutionStatus) {
    return status === "Passed" || status === "Flaky";
}

function isFailingStatus(status: ExecutionStatus) {
    return status === "Failed" || status === "Blocked";
}

const outcomeKey = (title: string, browser: string) => `${browser}::${title}`;

// Phase 17 Group 4 (TFP-073): "passed in one but not the other" is decided
// per (browser, title) key across the union of both runs' executed tests,
// not an assumption that both suites contain the same tests - a
// regenerated suite with one fewer test is exactly the acceptance example
// the decision record names, and that dropped test simply has no entry on
// one side.
function diffTestOutcomes(
    executionA: { title: string; browser: string; status: ExecutionStatus }[],
    executionB: { title: string; browser: string; status: ExecutionStatus }[]
) {
    const key = outcomeKey;
    const mapA = new Map(executionA.map((record) => [key(record.title, record.browser), record]));
    const mapB = new Map(executionB.map((record) => [key(record.title, record.browser), record]));
    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

    const testsPassedInAOnly: RunDiffTestStatusChange[] = [];
    const testsPassedInBOnly: RunDiffTestStatusChange[] = [];

    for (const testKey of allKeys) {
        const a = mapA.get(testKey);
        const b = mapB.get(testKey);
        const aPassed = a ? isPassingStatus(a.status) : false;
        const bPassed = b ? isPassingStatus(b.status) : false;

        if (aPassed && !bPassed) {
            testsPassedInAOnly.push({
                title: a!.title,
                browser: a!.browser,
                from: a!.status,
                to: b?.status ?? "not run",
            });
        } else if (bPassed && !aPassed) {
            testsPassedInBOnly.push({
                title: b!.title,
                browser: b!.browser,
                from: a?.status ?? "not run",
                to: b!.status,
            });
        }
    }

    return { testsPassedInAOnly, testsPassedInBOnly };
}

/**
 * Phase 47 (TFP-246, ruling 1, Emil, 2026-11-08): a title as two runs of one site are matched on - each page's path
 * in it replaced by its page type's pattern, grouped as site-suite reuse groups pages (Phase 40 Decision 1), over the
 * runs' pages together. So `/product/01M6XT24...` and `/product/01M6XVGE...` (a target reseeded between jobs) are one
 * test, `/product/:id`. A path that is its own pattern (`/contact`) is left as it is. A type of which any one run
 * tested two pages keeps its exact paths: merged, a new failure on one page could read as the other's known one.
 */
export function pageTypeTitles(pagesOfEachRun: string[][]): (title: string) => string {
    const types = groupPagesByAddress(pagesOfEachRun.flat()).filter((type) => pagesOfEachRun.every((pages) => type.pages.filter((path) => pages.includes(path)).length <= 1));
    const patterns = types.flatMap((type) => type.pages.filter((path) => path !== type.pattern).map((path) => [path, type.pattern] as const));
    if (patterns.length === 0) return (title) => title;
    // Longest first, and only a whole path: not inside `/product/12`, `/en/product/1` or `/product/1.html`.
    const sorted = [...patterns].sort((a, b) => b[0].length - a[0].length);
    const pattern = new RegExp(`(?<![\\w/.-])(${sorted.map(([path]) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w/-]|\\.\\w)`, "g");
    const typeOf = new Map(sorted);
    return (title) => title.replace(pattern, (path) => typeOf.get(path) ?? path);
}

/**
 * Phase 47 (TFP-246): per (browser, title), as diffTestOutcomes keys them, with the title as `keyOf` gives it (by
 * default the title itself). A test failing in A that B no longer runs is in none of the three: it neither passed nor
 * failed again. The changes carry B's own titles.
 */
export function diffFailures(
    executionA: { title: string; browser: string; status: ExecutionStatus }[],
    executionB: { title: string; browser: string; status: ExecutionStatus }[],
    keyOf: (title: string) => string = (title) => title
): RunDiffFailures {
    // Two records with one key (a repeated title): the failing one counts, so a pass can't hide a failure.
    const byKey = (execution: typeof executionA) => {
        const map = new Map<string, (typeof executionA)[number]>();
        for (const record of execution) {
            const key = outcomeKey(keyOf(record.title), record.browser);
            const kept = map.get(key);
            if (!kept || (isFailingStatus(record.status) && !isFailingStatus(kept.status))) map.set(key, record);
        }
        return map;
    };
    const mapA = byKey(executionA);
    const mapB = byKey(executionB);
    const failures: RunDiffFailures = { known: [], new: [], fixed: [] };

    for (const b of mapB.values()) {
        const a = mapA.get(outcomeKey(keyOf(b.title), b.browser));
        const change = { title: b.title, browser: b.browser, from: a?.status ?? ("not run" as const), to: b.status };
        if (isFailingStatus(b.status)) failures[a && isFailingStatus(a.status) ? "known" : "new"].push(change);
        else if (a && isFailingStatus(a.status) && isPassingStatus(b.status)) failures.fixed.push(change);
    }

    return failures;
}

function diffCoverageMatrices(
    matrixA: { requirement: string; percentage: number }[],
    matrixB: { requirement: string; percentage: number }[]
) {
    const mapA = new Map(matrixA.map((item) => [item.requirement, item.percentage]));
    const mapB = new Map(matrixB.map((item) => [item.requirement, item.percentage]));
    const areas = new Set([...mapA.keys(), ...mapB.keys()]);

    return [...areas].map((area): RunDiffCoverageAreaDelta => {
        const percentageA = mapA.get(area) ?? 0;
        const percentageB = mapB.get(area) ?? 0;
        return { area, percentageA, percentageB, delta: percentageB - percentageA };
    });
}

// Same composite identity the decision record names throughout (dom-snapshot.ts's
// own dedup key): elementType + containerLabel + locator.id + locator.name,
// falling back to text. Distinct from the title builders in locators.ts,
// which identify an element against its GENERATED TEST - this identifies an
// element against ITSELF across two independent introspection snapshots.
function elementIdentityKey(element: ActionableElementDetail) {
    const nameFallback = element.locator.name || element.text;
    return [element.elementType, element.containerLabel, element.locator.id, nameFallback].join("::");
}

function pagesByPath(profile: ContentProfile | null) {
    const map = new Map<string, ContentProfilePage>();
    for (const page of profile?.pages ?? []) {
        map.set(normalizeRoutePath(page.path), page);
    }
    return map;
}

function diffDiscoveredElements(profileA: ContentProfile | null, profileB: ContentProfile | null) {
    const pagesA = pagesByPath(profileA);
    const pagesB = pagesByPath(profileB);
    const allPaths = new Set([...pagesA.keys(), ...pagesB.keys()]);

    const elementsNewlyDiscovered: RunDiffElementChange[] = [];
    const elementsNewlyMissing: RunDiffElementChange[] = [];

    for (const path of allPaths) {
        const elementsA = pagesA.get(path)?.actionableElements ?? [];
        const elementsB = pagesB.get(path)?.actionableElements ?? [];
        const keysA = new Set(elementsA.map(elementIdentityKey));
        const keysB = new Set(elementsB.map(elementIdentityKey));

        for (const element of elementsB) {
            if (!keysA.has(elementIdentityKey(element))) {
                elementsNewlyDiscovered.push({
                    path,
                    elementName: getActionableElementDisplayName(element),
                    elementType: element.elementType,
                });
            }
        }

        for (const element of elementsA) {
            if (!keysB.has(elementIdentityKey(element))) {
                elementsNewlyMissing.push({
                    path,
                    elementName: getActionableElementDisplayName(element),
                    elementType: element.elementType,
                });
            }
        }
    }

    return { elementsNewlyDiscovered, elementsNewlyMissing };
}

function failureKeyOf(profileA: ContentProfile | null | undefined, profileB: ContentProfile | null | undefined, redact: (text: string) => string = (text) => text) {
    const byType = pageTypeTitles([profileA, profileB].map((profile) => (profile?.pages ?? []).map((page) => page.path)));
    return (title: string) => byType(redact(title));
}

/**
 * Phase 17 Group 4 (TFP-073): data + API only, per the decision record's
 * own scope lock - no diff UI in this phase. Both runIds must already be
 * validated (isValidRunId) by the caller before this is reached, the same
 * way GET/DELETE /api/run and PATCH /api/runs guard runId (TFP-066) - this
 * function itself does not re-validate, since loadRunRecord is the same
 * path-building call those routes protect.
 */
/**
 * `redact` (TFP-246, ruling 5): applied to both runs' titles before they are matched, so a run compared with a redacted
 * copy of its baseline (an earlier job's `--out/run.json`) matches a title that quotes a login value.
 */
export async function diffRuns(runIdA: string, runIdB: string, options: { redact?: (text: string) => string } = {}): Promise<RunDiffResult> {
    const [recordA, recordB] = await Promise.all([loadRunRecord(runIdA), loadRunRecord(runIdB)]);

    if (!recordA) {
        return { ok: false, error: "not-found-a" };
    }

    if (!recordB) {
        return { ok: false, error: "not-found-b" };
    }

    if (recordA.baseUrl !== recordB.baseUrl) {
        return { ok: false, error: "different-base-url" };
    }

    const executionA = recordA.result.report?.execution ?? [];
    const executionB = recordB.result.report?.execution ?? [];
    const { testsPassedInAOnly, testsPassedInBOnly } = diffTestOutcomes(executionA, executionB);

    const matrixA = recordA.result.report?.coverage.matrix ?? [];
    const matrixB = recordB.result.report?.coverage.matrix ?? [];
    const coverageDeltas = diffCoverageMatrices(matrixA, matrixB);

    const { elementsNewlyDiscovered, elementsNewlyMissing } = diffDiscoveredElements(
        recordA.contentProfile ?? null,
        recordB.contentProfile ?? null
    );

    return {
        ok: true,
        diff: {
            runIdA,
            runIdB,
            baseUrl: recordA.baseUrl,
            testsPassedInAOnly,
            testsPassedInBOnly,
            coverageDeltas,
            elementsNewlyDiscovered,
            elementsNewlyMissing,
            failures: diffFailures(executionA, executionB, failureKeyOf(recordA.contentProfile, recordB.contentProfile, options.redact)),
        },
    };
}
