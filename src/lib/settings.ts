/**
 * Phase 48 (TFP-275): every setting the app reads goes through `setting()`, by its short name (`"DATA_DIR"`, not
 * `"TESTFORGE_DATA_DIR"`), so the rename's fallback (TFP-276: the new name, then the old one) is written once, here,
 * not at each read.
 *
 * It returns the raw value, or undefined when unset: trimming, parsing and defaults stay with each caller, as before.
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

const PREFIX = "TESTFORGE_";

export function setting(name: SettingName, env: Record<string, string | undefined> = process.env): string | undefined {
    // next.config.ts's `env` replaces these two expressions, as written, at `next build`: a computed read would miss
    // them, and a built server would report the commit it was started on instead of the one it was built from.
    if (env === process.env && name === "BUILD_VERSION") return process.env.TESTFORGE_BUILD_VERSION;
    if (env === process.env && name === "BUILD_COMMIT") return process.env.TESTFORGE_BUILD_COMMIT;
    return env[PREFIX + name];
}
