/**
 * Phase 48 (TFP-275): every setting the app reads goes through `setting()`, by its short name (`"DATA_DIR"`, not
 * `"MRONION_DATA_DIR"`), so the rename's fallback is written once, here, not at each read.
 *
 * TFP-276 (Decision 5): a setting is read as `MRONION_<name>`, then as the old `TESTFORGE_<name>` until 1.0. When the
 * old name supplied the value, or both are set and differ (the new one wins), one notice per setting per process says
 * so, on stderr: the server's log or the CLI's.
 *
 * It returns the raw value, or undefined when unset: trimming, parsing and defaults stay with each caller.
 */
export const SETTINGS = [
    // Set by the tester, a pipeline or the launcher.
    "DATA_DIR",
    "RUNS_ROOT",
    "ENV",
    "CLI_CWD",
    "OLLAMA_MODEL",
    "OLLAMA_BASE_URL",
    "OLLAMA_TIMEOUT_MS",
    "OPENAI_TIMEOUT_MS",
    "GAP_LIMIT",
    "CLAUDE_COMMAND",
    "LIBRARY_PROMOTED_DIR",
    // Set by next.config.ts at `next build`.
    "BUILD_VERSION",
    "BUILD_COMMIT",
    // Set by a run for its own child processes (Phase 48 Decision 8).
    "INTERACTIVE",
    "STORAGE_STATE",
    "TIMING_FILE",
    "REQUEST_CAP_URL",
    "REQUEST_CAP_TOKEN",
    "REQUEST_CAP_DOMAIN",
    "NOT_JUDGED_TITLES",
    "NOT_JUDGED_REASON",
] as const;

export type SettingName = (typeof SETTINGS)[number];

const PREFIX = "MRONION_";
const OLD_PREFIX = "TESTFORGE_";

// On globalThis, not in this module: Next bundles a module into each chunk that imports it, and the notice is once
// per process, not once per copy.
const NOTICED = Symbol.for("mr-onion.setting-notices");
const noticed = ((globalThis as { [NOTICED]?: Set<string> })[NOTICED] ??= new Set<string>());

function notice(name: SettingName, text: string) {
    if (noticed.has(name)) return;
    noticed.add(name);
    console.warn(text);
}

export function setting(name: SettingName, env: Record<string, string | undefined> = process.env): string | undefined {
    // next.config.ts's `env` replaces these two expressions, as written, at `next build`: a computed read would miss
    // them, and a built server would report the commit it was started on instead of the one it was built from. Only
    // the build sets them, so they have no old name to fall back to.
    if (env === process.env && name === "BUILD_VERSION") return process.env.MRONION_BUILD_VERSION;
    if (env === process.env && name === "BUILD_COMMIT") return process.env.MRONION_BUILD_COMMIT;
    if (name === "BUILD_VERSION" || name === "BUILD_COMMIT") return env[PREFIX + name];
    const value = env[PREFIX + name];
    const old = env[OLD_PREFIX + name];
    if (old === undefined || old === value) return value;
    if (value === undefined) {
        notice(name, `${OLD_PREFIX}${name} is now ${PREFIX}${name}; the old name stops working at 1.0.`);
        return old;
    }
    notice(name, `${PREFIX}${name} and ${OLD_PREFIX}${name} are both set and differ; using ${PREFIX}${name}. The old name stops working at 1.0.`);
    return value;
}

/**
 * Decision 8: what a run sets for its child processes, under both names with the same value. A saved suite written
 * before the rename checks `TESTFORGE_INTERACTIVE`, and keeps running as it did. A name with neither prefix is kept
 * as it is.
 */
export function underBothNames(values: Record<string, string>): Record<string, string> {
    const both = { ...values };
    for (const [key, value] of Object.entries(values)) {
        if (key.startsWith(OLD_PREFIX)) both[PREFIX + key.slice(OLD_PREFIX.length)] = value;
        else if (key.startsWith(PREFIX)) both[OLD_PREFIX + key.slice(PREFIX.length)] = value;
    }
    return both;
}
