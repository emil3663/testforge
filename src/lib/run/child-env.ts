/**
 * Phase 42 (TFP-202, batch 2 ruling 5): the environment a Playwright run
 * gets. A run's spec file can hold code a model wrote - gap tests, pool
 * candidates, promoted library entries - and a test runs in Node, so it can
 * read whatever environment the run inherits. TestForge's own environment
 * holds API keys, tokens and its settings (OPENAI_API_KEY and the rest of
 * .env.development, TESTFORGE_*), none of which a test needs.
 *
 * So no run inherits it. A run gets only what Node, the Playwright CLI and
 * the browser need to start on this machine, named below, plus what
 * TestForge sets for that run on purpose (the interactive switch, the run's
 * login state, the JSON report's path). Everything else is left out.
 *
 * This keeps keys out of a test's reach; it is not a sandbox. A real one
 * (the tests run inside Docker) is for the post-Phase 42 review.
 */

/** What the run's process needs to start: the OS, temp and home folders, locale, display, and Playwright's browsers. */
const PASSED_ON = new Set([
    // Windows
    "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE", "COMSPEC", "PATHEXT", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
    "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)", "COMMONPROGRAMW6432", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
    "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "OS",
    // Any OS
    "PATH", "HOME", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "CI",
    // Linux displays and fonts, for a headed or headless browser
    "DISPLAY", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "XAUTHORITY", "FONTCONFIG_PATH",
    // Where Playwright's browsers are installed, when not in the default place
    "PLAYWRIGHT_BROWSERS_PATH",
]);

/** The run's environment: the names above from `from` (matched without case, as Windows does), then `set`. */
export function runEnv(set: Record<string, string>, from: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    // Next.js types every environment as having NODE_ENV; a run's doesn't need it.
    const env = {} as NodeJS.ProcessEnv;
    for (const [name, value] of Object.entries(from)) {
        if (value !== undefined && PASSED_ON.has(name.toUpperCase())) env[name] = value;
    }
    return { ...env, ...set };
}
