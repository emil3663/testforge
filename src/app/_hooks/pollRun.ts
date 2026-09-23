import type { RunLifecycleStatus, RunResult, RunStatusSnapshot } from "@/app/_lib/types";

// Bounded retry/backoff for a transient poll failure (network blip, dev-server
// restart) before it surfaces as a user-visible error - see TFP-068.
export const POLL_RETRY_DELAYS_MS = [500, 1000, 2000];

// A terminal runStatus is treated as a stop condition alongside `result`
// being set, so a future finalize path that reaches a terminal status
// without a result (the exact class of bug TFP-065 fixed once already)
// can't leave this hook polling forever - see TFP-068.
const TERMINAL_RUN_STATUSES = new Set<RunLifecycleStatus>(["passed", "failed", "cancelled"]);

export interface RunPollDeps {
    fetchImpl: typeof fetch;
    sleep: (ms: number) => Promise<void>;
    isCancelled: () => boolean;
    onSnapshot: (snapshot: RunStatusSnapshot) => void;
    onResult: (result: RunResult) => void;
    onTerminalWithoutResult: () => void;
    onFailure: (message: string) => void;
}

// Framework-agnostic poll loop, unit-tested directly in useRun.test.ts against
// a mocked fetch/sleep - useRun.ts wires this to the real fetch/setTimeout.
// Stops on: a result payload, a terminal runStatus with no result (safety
// net), or POLL_RETRY_DELAYS_MS.length consecutive failures. A single
// transient failure retries with backoff instead of abandoning the run.
export async function pollRunUntilDone(runId: string, deps: RunPollDeps): Promise<void> {
    let consecutiveFailures = 0;

    for (; ;) {
        if (deps.isCancelled()) {
            return;
        }

        try {
            const response = await deps.fetchImpl(`/api/run?runId=${encodeURIComponent(runId)}`, {
                cache: "no-store",
            });
            const data = (await response.json()) as RunStatusSnapshot | { error?: string };

            if (!response.ok) {
                throw new Error("error" in data ? data.error ?? "Run status check failed" : "Run status check failed");
            }

            if (deps.isCancelled()) {
                return;
            }

            consecutiveFailures = 0;

            const snapshot = data as RunStatusSnapshot;
            deps.onSnapshot(snapshot);

            if (snapshot.result) {
                deps.onResult(snapshot.result);
                return;
            }

            if (TERMINAL_RUN_STATUSES.has(snapshot.runStatus)) {
                deps.onTerminalWithoutResult();
                return;
            }

            await deps.sleep(800);
        } catch (err: unknown) {
            if (deps.isCancelled()) {
                return;
            }

            if (consecutiveFailures < POLL_RETRY_DELAYS_MS.length) {
                const delay = POLL_RETRY_DELAYS_MS[consecutiveFailures];
                consecutiveFailures += 1;
                await deps.sleep(delay);
                continue;
            }

            deps.onFailure(err instanceof Error ? err.message : "Run status check failed");
            return;
        }
    }
}
