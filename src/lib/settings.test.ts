/**
 * Phase 48 (TFP-275): one reader for every setting, so the rename's fallback is written once. This ticket changes no
 * behaviour: `setting(name)` returns exactly what `process.env.TESTFORGE_<name>` held.
 *
 * ISTQB techniques: equivalence partitioning of a setting's state (set, set to blank or padded text, unset) and of
 * where it is read from (the process environment, an environment passed in), plus the build-time names, which
 * next.config.ts's `env` replaces only where they are written out literally.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/settings.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { setting, SETTINGS } from "./settings.ts";

test("a setting is read by its short name, as the raw value the environment holds", () => {
    const env = { TESTFORGE_GAP_LIMIT: "3", TESTFORGE_DATA_DIR: " /srv/data ", TESTFORGE_OLLAMA_MODEL: "" };
    assert.equal(setting("GAP_LIMIT", env), "3");
    // Trimming and blank-as-unset stay with each caller, as they were before the reader existed.
    assert.equal(setting("DATA_DIR", env), " /srv/data ");
    assert.equal(setting("OLLAMA_MODEL", env), "");
    assert.equal(setting("CLAUDE_COMMAND", env), undefined);
});

test("only the TESTFORGE_ name is read: the short name alone, or another prefix, is not a setting", () => {
    assert.equal(setting("GAP_LIMIT", { GAP_LIMIT: "3", MRONION_GAP_LIMIT: "4" }), undefined);
});

test("without an environment passed in, it reads the process's own, at each call", (t) => {
    const saved = { gapLimit: process.env.TESTFORGE_GAP_LIMIT, buildVersion: process.env.TESTFORGE_BUILD_VERSION };
    t.after(() => {
        if (saved.gapLimit === undefined) delete process.env.TESTFORGE_GAP_LIMIT;
        else process.env.TESTFORGE_GAP_LIMIT = saved.gapLimit;
        if (saved.buildVersion === undefined) delete process.env.TESTFORGE_BUILD_VERSION;
        else process.env.TESTFORGE_BUILD_VERSION = saved.buildVersion;
    });
    delete process.env.TESTFORGE_GAP_LIMIT;
    assert.equal(setting("GAP_LIMIT"), undefined);
    process.env.TESTFORGE_GAP_LIMIT = "7";
    assert.equal(setting("GAP_LIMIT"), "7");
    process.env.TESTFORGE_BUILD_VERSION = "9.9.9";
    assert.equal(setting("BUILD_VERSION"), "9.9.9");
    // An environment passed in is read, not the process's: the build-time branch is for process.env alone.
    assert.equal(setting("BUILD_VERSION", { TESTFORGE_BUILD_VERSION: "1.0.0" }), "1.0.0");
});

test("the build-time names are written out as next.config.ts's env sets them, so `next build` can replace them", () => {
    const source = readFileSync(join(import.meta.dirname, "settings.ts"), "utf8");
    const built = readFileSync(join(import.meta.dirname, "..", "..", "next.config.ts"), "utf8").match(/env: \{([^}]*)\}/)?.[1] ?? "";
    const names = [...built.matchAll(/(TESTFORGE_\w+):/g)].map((match) => match[1]);
    assert.deepEqual(names, ["TESTFORGE_BUILD_VERSION", "TESTFORGE_BUILD_COMMIT"]);
    // The bundle (`next build`, then .next/server) is the proof the replacement happens; this keeps the expression
    // from being refactored into a computed read without anyone noticing.
    for (const name of names) assert.ok(source.includes(`return process.env.${name};`), `settings.ts must return process.env.${name} as written`);
});

test("every name is listed once", () => {
    assert.equal(new Set(SETTINGS).size, SETTINGS.length);
});
