import { readFile, writeFile } from "node:fs/promises";
import { REQUEST_CAP_STARVED_ANNOTATION, REQUEST_CAP_WAITS_ANNOTATION } from "@/lib/report/execution";
import type { RawTiming, TimingStep } from "@/lib/run/timing";

/**
 * TFP-264 (ruling 4 amended, item 2 as amended, and amended again, Emil, 2026-10-28): on a capped host, a test that
 * failed is starved by the request cap when its own requests' waiting for slots during the step that failed (from the
 * step's start to the failure) is as long as that step's assertion wait: 2 s for a shared check, 5 s otherwise; or,
 * when that step isn't an assertion, when it timed out with one of its requests still waiting. Waiting earlier in the
 * test doesn't count, so a check that fails at once, or after its requests arrived, stays Failed.
 *
 * The cap's module (request-cap-fixture.ts) records the test's waiting spans and its assertion wait; the timing reporter
 * (timing.ts) records when each step started and whether it failed. Neither alone can tell: the worker doesn't see
 * steps, and the reporter doesn't see slots. Run once a capped run's passes are merged, before the stale re-check reads
 * the report's failures, this adds a `request-cap-starved` annotation to each starved test in the JSON report, which
 * the report reads as Not run. The re-check runs without the timing reporter, so a reused test it re-runs keeps the
 * re-run's own result.
 */

/**
 * A step lasts a little under its assertion wait as Playwright measures it (TFP-215's boundary test allows a 2 s
 * shared check 1,900 ms), and waiting can't outlast the step, so "as long as its assertion wait" allows this much.
 */
export const STEP_TIMING_SLACK_MS = 100;

export interface CapWaits {
    assertionWaitMs: number;
    /** [start, end] in ms since the epoch: when at least one of the test's own requests waited for a slot. */
    spans: Array<[number, number]>;
}

/** How long the spans cover inside [from, to]. */
export function waitingWithin(spans: Array<[number, number]>, from: number, to: number): number {
    return spans.reduce((total, [start, end]) => total + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0);
}

/**
 * The step that failed: the test's last step to end, when it failed. A step that failed and was caught (TestForge's
 * settle wait, `waitForLoadState('networkidle').catch(...)`, fails whenever it reaches its cap) is never it, nor is an
 * earlier failure the test went on from. A test that failed outside any recorded step (a hook, a fixture, a plain
 * throw) has none, and stands.
 */
export function failingStep(steps: TimingStep[]): (TimingStep & { startedAt: number }) | null {
    const timed = steps.filter((step): step is TimingStep & { startedAt: number } => step.startedAt !== undefined);
    const last = timed.reduce<(TimingStep & { startedAt: number }) | null>((latest, step) => (!latest || step.startedAt + step.duration >= latest.startedAt + latest.duration ? step : latest), null);
    return last && last.failed && last.kind !== "settle" ? last : null;
}

/**
 * Why the cap starved the test, or null when its failure stands. An assertion (`expect`) is starved when its requests
 * waited through its assertion wait. Any other step (a click, fill or load that waited out its timeout) is starved only
 * when it timed out and one of its requests was still waiting for a slot as it did, within the same slack (amended
 * again, and a third clarification, 2026-10-28): the page was still incomplete when it was judged. A missing button on
 * a page that had finished loading stays Failed, however long the page waited first; so does an action that failed at
 * once (a strict-mode violation, a detached element, an invalid selector), on what the page is, not on the wait.
 */
export function starvedReason(waits: CapWaits, steps: TimingStep[]): string | null {
    const step = failingStep(steps);
    if (!step) return null;
    const failedAt = step.startedAt + step.duration;
    const during = waitingWithin(waits.spans, step.startedAt, failedAt);
    if (step.kind !== "expect") {
        if (!step.timedOut) return null;
        const stillWaiting = waits.spans.some(([start, end]) => start <= failedAt && end >= failedAt - STEP_TIMING_SLACK_MS);
        if (!stillWaiting) return null;
        return `starved by the request cap: when the step that failed gave up, its requests were still waiting for slots (${(during / 1000).toFixed(1)} s of waiting during it), so its failure says nothing about the site`;
    }
    if (during < waits.assertionWaitMs - STEP_TIMING_SLACK_MS) return null;
    return `starved by the request cap: during the step that failed, its requests waited ${(during / 1000).toFixed(1)} s for slots, as long as its ${waits.assertionWaitMs / 1000} s assertion wait, so its failure says nothing about the site`;
}

type JsonTest = { status?: string; annotations?: Array<{ type: string; description?: string }> };
type JsonSuite = { specs?: Array<{ id?: string; tests?: JsonTest[] }>; suites?: JsonSuite[] };

/** Marks each starved test in the run's JSON report; returns how many. A test with no timing for its steps stands. */
export async function markCapStarved(reportFile: string, timingFile: string): Promise<number> {
    const report = JSON.parse(await readFile(reportFile, "utf8")) as { suites?: JsonSuite[] };
    const timing = JSON.parse(await readFile(timingFile, "utf8").catch(() => '{"tests":[]}')) as Partial<RawTiming>;
    // The latest attempt of each test, by its id.
    const steps = new Map<string, { retry: number; steps: TimingStep[] }>();
    for (const entry of timing.tests ?? []) {
        if (!entry.id) continue;
        const seen = steps.get(entry.id);
        if (!seen || entry.retry >= seen.retry) steps.set(entry.id, { retry: entry.retry, steps: entry.steps });
    }
    let marked = 0;
    const walk = (suites: JsonSuite[]) => {
        for (const suite of suites) {
            for (const spec of suite.specs ?? []) {
                for (const test of spec.tests ?? []) {
                    if (test.status !== "unexpected" || !spec.id) continue;
                    if (test.annotations?.some((annotation) => annotation.type === REQUEST_CAP_STARVED_ANNOTATION)) continue;
                    const recorded = test.annotations?.find((annotation) => annotation.type === REQUEST_CAP_WAITS_ANNOTATION)?.description;
                    const timed = steps.get(spec.id);
                    if (!recorded || !timed) continue;
                    let waits: CapWaits;
                    try {
                        waits = JSON.parse(recorded) as CapWaits;
                    } catch {
                        continue;
                    }
                    const reason = starvedReason(waits, timed.steps);
                    if (!reason) continue;
                    test.annotations!.push({ type: REQUEST_CAP_STARVED_ANNOTATION, description: reason });
                    marked++;
                }
            }
            walk(suite.suites ?? []);
        }
    };
    walk(report.suites ?? []);
    if (marked > 0) await writeFile(reportFile, JSON.stringify(report), "utf8");
    return marked;
}
