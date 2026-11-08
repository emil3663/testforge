import { stopAllServers } from "@/cli/servers";

/**
 * Phase 47 (TFP-245): however `testforge run` ends - Ctrl+C, a cancelled CI job (SIGTERM), or a crash - every
 * server `--server` started is stopped first, and the exit code says the run couldn't run (2), never 1 ("a test
 * failed"), which is what Node would give an uncaught error.
 */
export const EXIT_COULD_NOT_RUN = 2;

/** Stops the servers, says why, then exits. Only the first call acts: a second Ctrl+C doesn't cut the stop short. */
export function exitHandler(exit: (code: number) => void = (code) => process.exit(code), log: (line: string) => void = (line) => console.error(line), graceMs?: number) {
    let ending: Promise<void> | null = null;
    return (why: string) => {
        ending ??= (async () => {
            log(`testforge: ${why}; stopping the server(s) it started.`);
            await stopAllServers(graceMs).catch(() => undefined);
            exit(EXIT_COULD_NOT_RUN);
        })();
        return ending;
    };
}

export function installExitHandlers() {
    const end = exitHandler();
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) {
        process.on(signal, () => void end(`stopped by ${signal}`));
    }
    process.on("uncaughtException", (error) => void end(`couldn't run: ${error.stack ?? error.message}`));
    process.on("unhandledRejection", (reason) => void end(`couldn't run: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`));
}
