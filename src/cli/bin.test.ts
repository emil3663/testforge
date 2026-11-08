/**
 * Phase 48 (TFP-276, Decision 5): `mr-onion` is the command, and `testforge` still works until 1.0. Both run the same
 * CLI with the same exit code and output; `testforge` adds one line on stderr, and `mr-onion` adds nothing.
 *
 * ISTQB techniques: equivalence partitioning of how a run ends before it reaches a site (help, exit 0; an invalid
 * configuration, exit 3), each through both commands, as real processes.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/bin.test.ts
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const DEPRECATION = "testforge is now mr-onion; the old name stops working at 1.0.";

// The shell's own settings, under either name, would add their notices to stderr.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(MRONION|TESTFORGE)_/i.test(name))) as NodeJS.ProcessEnv;

function run(command: "mr-onion" | "testforge", args: string[]) {
    const result = spawnSync(process.execPath, [join(ROOT, "bin", `${command}.mjs`), ...args], { env: ENV, encoding: "utf8", timeout: 60_000 });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr.trim() };
}

test("--help: both exit 0 with the same usage; only testforge adds its one line", () => {
    const current = run("mr-onion", ["run", "--help"]);
    const old = run("testforge", ["run", "--help"]);
    assert.equal(current.status, 0, current.stderr);
    assert.match(current.stdout, /^Usage: mr-onion run --url <base URL>/);
    assert.equal(current.stderr, "");
    assert.deepEqual(old, { status: 0, stdout: current.stdout, stderr: DEPRECATION });
});

test("an invalid configuration: both exit 3 with the same message; only testforge adds its one line", () => {
    const current = run("mr-onion", ["run", "--no-such-flag"]);
    const old = run("testforge", ["run", "--no-such-flag"]);
    assert.equal(current.status, 3, current.stderr);
    assert.match(current.stderr, /is not an option of mr-onion run/);
    assert.doesNotMatch(current.stderr, /testforge is now/);
    assert.deepEqual(old, { status: 3, stdout: current.stdout, stderr: `${DEPRECATION}\n${current.stderr}` });
});
