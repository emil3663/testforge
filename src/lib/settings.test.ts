/**
 * Phase 48 (TFP-275, TFP-276): one reader for every setting. A setting is read as MRONION_<name>, then as the old
 * TESTFORGE_<name> until 1.0, with one notice per setting per process when the old name is used or the two disagree.
 *
 * ISTQB techniques: decision table of the two names (neither, new only, old only, both equal, both different), with
 * the value read and whether a notice is printed for each; equivalence partitioning of the value (set, blank, padded)
 * and of where it is read from (the process environment, an environment passed in); the build-time names, which
 * next.config.ts's `env` replaces only where they are written out literally; and a real process for "once per process".
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/settings.test.ts
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setting, SETTINGS, underBothNames } from "./settings.ts";

const ROOT = join(import.meta.dirname, "..", "..");

function notices(t: TestContext) {
    return t.mock.method(console, "warn", () => {}).mock;
}

// Each case below uses a setting no other case uses: the notice is once per setting per process.
test("the new name alone: its raw value, and no notice", (t) => {
    const warn = notices(t);
    assert.equal(setting("GAP_LIMIT", { MRONION_GAP_LIMIT: "3" }), "3");
    // Trimming and blank-as-unset stay with each caller, as they were before the reader existed.
    assert.equal(setting("DATA_DIR", { MRONION_DATA_DIR: " /srv/data " }), " /srv/data ");
    assert.equal(setting("OLLAMA_MODEL", { MRONION_OLLAMA_MODEL: "" }), "");
    assert.equal(setting("CLAUDE_COMMAND", {}), undefined);
    assert.equal(warn.callCount(), 0);
});

test("the old name alone: its value, with a notice naming both", (t) => {
    const warn = notices(t);
    assert.equal(setting("RUNS_ROOT", { TESTFORGE_RUNS_ROOT: "/srv/runs" }), "/srv/runs");
    assert.deepEqual(warn.calls.map((call) => call.arguments), [["TESTFORGE_RUNS_ROOT is now MRONION_RUNS_ROOT; the old name stops working at 1.0."]]);
});

test("both names, the same value: that value, and no notice", (t) => {
    const warn = notices(t);
    assert.equal(setting("INTERACTIVE", { MRONION_INTERACTIVE: "1", TESTFORGE_INTERACTIVE: "1" }), "1");
    assert.equal(warn.callCount(), 0);
});

test("both names, different values: the new one wins, and the notice says so", (t) => {
    const warn = notices(t);
    assert.equal(setting("OLLAMA_BASE_URL", { MRONION_OLLAMA_BASE_URL: "http://new", TESTFORGE_OLLAMA_BASE_URL: "http://old" }), "http://new");
    assert.deepEqual(warn.calls.map((call) => call.arguments), [
        ["MRONION_OLLAMA_BASE_URL and TESTFORGE_OLLAMA_BASE_URL are both set and differ; using MRONION_OLLAMA_BASE_URL. The old name stops working at 1.0."],
    ]);
});

test("a blank new name with an old value: the old value, with a notice saying the new one is blank (Decision 5, amended 2026-11-09)", (t) => {
    // A pipeline that templates in an empty MRONION_X must not lose the TESTFORGE_X it already sets.
    const warn = notices(t);
    assert.equal(setting("ENV", { MRONION_ENV: "", TESTFORGE_ENV: "ci" }), "ci");
    assert.equal(setting("LIBRARY_PROMOTED_DIR", { MRONION_LIBRARY_PROMOTED_DIR: "  ", TESTFORGE_LIBRARY_PROMOTED_DIR: "/lib" }), "/lib");
    assert.deepEqual(warn.calls.map((call) => call.arguments), [
        ["MRONION_ENV is blank; using TESTFORGE_ENV. The old name stops working at 1.0."],
        ["MRONION_LIBRARY_PROMOTED_DIR is blank; using TESTFORGE_LIBRARY_PROMOTED_DIR. The old name stops working at 1.0."],
    ]);
});

test("the short name alone is not a setting", () => {
    assert.equal(setting("TIMING_FILE", { TIMING_FILE: "x" }), undefined);
});

test("one notice per setting per process: a real process reads two old names, each twice, through two copies of the module", () => {
    // Two copies, as Next makes when it bundles the module into each chunk that imports it: a query string loads the
    // file again as a module of its own, with its own top-level state.
    const script = `
const one = await import("./src/lib/settings.ts");
const two = await import("./src/lib/settings.ts?copy");
if (one === two) throw new Error("expected two copies of the module");
for (const { setting } of [one, two]) { setting("GAP_LIMIT"); setting("OLLAMA_MODEL"); }
process.stdout.write(String(two.setting("GAP_LIMIT")));
`;
    const result = spawnSync(process.execPath, ["--import", "./scripts/register-node-test-ts-resolver.mjs", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script], {
        cwd: ROOT,
        env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TESTFORGE_GAP_LIMIT: "4", TESTFORGE_OLLAMA_MODEL: "m" } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "4");
    assert.deepEqual(result.stderr.trim().split(/\r?\n/), [
        "TESTFORGE_GAP_LIMIT is now MRONION_GAP_LIMIT; the old name stops working at 1.0.",
        "TESTFORGE_OLLAMA_MODEL is now MRONION_OLLAMA_MODEL; the old name stops working at 1.0.",
    ]);
});

test("without an environment passed in, it reads the process's own, at each call", (t) => {
    const names = ["MRONION_CLI_CWD", "TESTFORGE_CLI_CWD", "MRONION_BUILD_VERSION"];
    const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    t.after(() => {
        for (const name of names) {
            if (saved[name] === undefined) delete process.env[name];
            else process.env[name] = saved[name];
        }
    });
    for (const name of names) delete process.env[name];
    assert.equal(setting("CLI_CWD"), undefined);
    process.env.MRONION_CLI_CWD = "/work";
    assert.equal(setting("CLI_CWD"), "/work");
    process.env.MRONION_BUILD_VERSION = "9.9.9";
    assert.equal(setting("BUILD_VERSION"), "9.9.9");
    // An environment passed in is read, not the process's: the build-time branch is for process.env alone.
    assert.equal(setting("BUILD_VERSION", { MRONION_BUILD_VERSION: "1.0.0" }), "1.0.0");
});

test("the build-time names have no old name: only the build sets them", (t) => {
    const warn = notices(t);
    assert.equal(setting("BUILD_COMMIT", { TESTFORGE_BUILD_COMMIT: "abc1234" }), undefined);
    assert.equal(warn.callCount(), 0);
});

test("the build-time names are written out as next.config.ts's env sets them, so `next build` can replace them", () => {
    const source = readFileSync(join(import.meta.dirname, "settings.ts"), "utf8");
    const built = readFileSync(join(ROOT, "next.config.ts"), "utf8").match(/env: \{([^}]*)\}/)?.[1] ?? "";
    const names = [...built.matchAll(/([A-Z_]+_BUILD_\w+):/g)].map((match) => match[1]);
    assert.deepEqual(names, ["MRONION_BUILD_VERSION", "MRONION_BUILD_COMMIT"]);
    // The bundle (`next build`, then .next/server) is the proof the replacement happens; this keeps the expression
    // from being refactored into a computed read without anyone noticing.
    for (const name of names) assert.ok(source.includes(`return process.env.${name};`), `settings.ts must return process.env.${name} as written`);
});

test("underBothNames: each setting a run passes on, under both names with the same value; other names as they are", () => {
    assert.deepEqual(underBothNames({ TESTFORGE_INTERACTIVE: "0", MRONION_TIMING_FILE: "/t.json", FORCE_COLOR: "0" }), {
        TESTFORGE_INTERACTIVE: "0",
        MRONION_INTERACTIVE: "0",
        MRONION_TIMING_FILE: "/t.json",
        TESTFORGE_TIMING_FILE: "/t.json",
        FORCE_COLOR: "0",
    });
});

test("every name is listed once", () => {
    assert.equal(new Set(SETTINGS).size, SETTINGS.length);
});
