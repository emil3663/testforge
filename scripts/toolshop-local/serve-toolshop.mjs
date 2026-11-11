// Phase 47 (TFP-245): the local Toolshop as a `mr-onion run --server` command. start-toolshop.ps1 starts the
// containers and returns, so on its own there would be nothing for --server to stop. This starts it, stays running
// while the run goes, and stops the containers (stop-toolshop.ps1) when its stdin closes - which is how `mr-onion
// run` asks a server to stop - or on Ctrl+C or a signal. It exits non-zero if the start fails, so the run ends with
// exit 2.
//
// The app's port answers before the start script has seeded the database, so `--port 4200` could start the run on a
// half-ready Toolshop. With --ready-port, this listens on that loopback port only once the start has finished; give
// that port to --server's --port.
//
//   node scripts/toolshop-local/serve-toolshop.mjs sprint5 [--ready-port 4299]            # the clean version
//   node scripts/toolshop-local/serve-toolshop.mjs sprint5-with-bugs [--ready-port 4299]
//
//   npm run mr-onion -- run --url http://localhost:4200 --server-timeout 600 \
//     --server "node scripts/toolshop-local/serve-toolshop.mjs sprint5 --ready-port 4299" --port 4299
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [sprint, readyFlag, readyValue] = process.argv.slice(2);
const readyPort = readyFlag === "--ready-port" ? Number(readyValue) : null;
if ((sprint !== "sprint5" && sprint !== "sprint5-with-bugs") || (readyFlag !== undefined && !(Number.isInteger(readyPort) && readyPort > 0))) {
    console.error("usage: node serve-toolshop.mjs sprint5|sprint5-with-bugs [--ready-port <n>]");
    process.exit(2);
}

/** A script beside this one, and the PowerShell process running it (to end its tree if a stop comes first). */
function powershell(script, args = []) {
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(here, script), ...args], { stdio: ["ignore", "inherit", "inherit"], windowsHide: true });
    const done = new Promise((resolve) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", (error) => {
            console.error(error.message);
            resolve(1);
        });
    });
    return { child, done };
}

let start = null;
let stopping = null;
/** Stops the containers and exits: 1 when the start failed or the stop did, so a failed start never reads as a clean exit. */
function stop(reason, failed = false) {
    stopping ??= (async () => {
        console.log(`serve-toolshop: ${reason}; stopping the Toolshop.`);
        // A start still going (a stop asked for during it, e.g. at --server-timeout) is ended first, with everything
        // it started, so it can't bring the containers up after the stop.
        if (start && start.child.exitCode === null && start.child.pid !== undefined) {
            spawnSync("taskkill", ["/pid", String(start.child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
            await start.done;
        }
        const code = await powershell("stop-toolshop.ps1").done;
        process.exit(failed || code !== 0 ? 1 : 0);
    })();
    return stopping;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(signal, () => void stop(signal));
process.stdin.on("end", () => void stop("stdin closed"));
process.stdin.on("error", () => void stop("stdin closed"));
process.stdin.resume();

start = powershell("start-toolshop.ps1", ["-Sprint", sprint]);
const started = await start.done;
if (stopping) await stopping;
if (started !== 0) {
    console.error(`serve-toolshop: start-toolshop.ps1 -Sprint ${sprint} failed (exit ${started}).`);
    await stop("the start failed", true);
}
if (readyPort !== null) {
    // Accepts and drops connections: only its answering matters. A port already taken stops the Toolshop again.
    createServer((socket) => socket.destroy())
        .on("error", (error) => void stop(`the ready port ${readyPort} couldn't open (${error.code ?? error.message})`, true))
        .listen(readyPort, "127.0.0.1");
}
console.log(`serve-toolshop: ${sprint} is running${readyPort !== null ? ` (ready on 127.0.0.1:${readyPort})` : ""}; close stdin or press Ctrl+C to stop it.`);
