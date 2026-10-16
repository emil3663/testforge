import { onRunPersisted } from "@/lib/run/persistence";
import { NapiClient } from "./client.ts";
import { readNapiConfig } from "./config.ts";
import { startNapiPoller } from "./poller.ts";
import { pushRunToNapi } from "./push.ts";

/**
 * Wires napi in at server start (src/instrumentation.ts) when it is
 * configured: every persisted run is pushed, and queued runs are polled for.
 * Unconfigured, nothing is attempted and nothing is logged beyond one line.
 */
export function bootNapi(env: Record<string, string | undefined> = process.env, log: (line: string) => void = console.log): (() => void) | null {
    const config = readNapiConfig(env);
    if (!config) {
        log("napi: off (set NAPI_URL, NAPI_CLIENT_ID, NAPI_CLIENT_SECRET and NAPI_COMPANY_ID to push runs to Lighthouse)");
        return null;
    }
    const client = new NapiClient(config);
    const unsubscribe = onRunPersisted((record) => void pushRunToNapi(client, record, log));
    const stopPolling = config.pollSeconds > 0 ? startNapiPoller({ client, config, log }) : () => {};
    log(`napi: on, pushing runs to ${config.url}${config.pollSeconds > 0 ? ` and polling for queued runs every ${config.pollSeconds}s` : ""}`);
    return () => {
        unsubscribe();
        stopPolling();
    };
}
