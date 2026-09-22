import { getActionableElementDisplayName, normalizeRoutePath } from "@/lib/generate/mock/locators";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage } from "@/lib/generate/mock/types";
import type { ExecutionStatus } from "@/lib/report/types";
import { loadRunRecord } from "@/lib/run/persistence";

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
}

export type RunDiffError = "not-found-a" | "not-found-b" | "different-base-url";
export type RunDiffResult = { ok: true; diff: RunDiff } | { ok: false; error: RunDiffError };

function isPassingStatus(status: ExecutionStatus) {
    return status === "Passed" || status === "Flaky";
}

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
    const key = (title: string, browser: string) => `${browser}::${title}`;
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

/**
 * Phase 17 Group 4 (TFP-073): data + API only, per the decision record's
 * own scope lock - no diff UI in this phase. Both runIds must already be
 * validated (isValidRunId) by the caller before this is reached, the same
 * way GET/DELETE /api/run and PATCH /api/runs guard runId (TFP-066) - this
 * function itself does not re-validate, since loadRunRecord is the same
 * path-building call those routes protect.
 */
export async function diffRuns(runIdA: string, runIdB: string): Promise<RunDiffResult> {
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
        },
    };
}
