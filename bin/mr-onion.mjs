#!/usr/bin/env node
// Phase 47 (TFP-245): the `mr-onion` command (`testforge` until Phase 48; bin/testforge.mjs is that name's alias,
// until 1.0). It runs src/cli/main.ts with the repo's own TypeScript loader, from TestForge's folder (the run executor
// finds Playwright and its working folders there), and passes on the folder the command was typed in, so --out,
// --config and --data-dir resolve where the user expects: under both names (Phase 48 Decision 8), so an inherited old
// one can't disagree with it. Its exit code is the CLI's.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(
    process.execPath,
    ["--import", "./scripts/register-node-test-ts-resolver.mjs", "--experimental-strip-types", "--no-warnings", "src/cli/main.ts", ...process.argv.slice(2)],
    { cwd: root, stdio: "inherit", env: { ...process.env, MRONION_CLI_CWD: process.cwd(), TESTFORGE_CLI_CWD: process.cwd() } }
);
// The CLI stops the servers it started before it exits, so this waits for it. On POSIX a signal is passed on; on
// Windows Ctrl+C already reaches the CLI through the shared console, and kill() there would end it at once, unstopped.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    process.on(signal, () => {
        if (process.platform !== "win32") child.kill(signal);
    });
}
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 2 : 0)));
