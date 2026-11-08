import { spawn, spawnSync, type ChildProcess } from "child_process";
import { connect } from "net";
import type { ServerSpec } from "@/cli/config";

/**
 * Phase 47 Decision 2, amended 2026-11-02 (TFP-245): `--server "<command>" --port <n>` starts each command, waits
 * until its port answers, and stops every server it started once the run is over, whatever the result. The pattern
 * of `scripts/with_server.py` in Anthropic's webapp-testing skill (Apache-2.0); no code of it is used.
 *
 * Stopping is gentle first: the server's stdin is closed (a wrapper such as serve-toolshop.mjs stops its containers
 * on that) and, on Linux and macOS, its process group gets SIGTERM. Whatever is still running after the grace period
 * is killed with its whole process tree.
 */

export class ServerStartError extends Error {}

export interface StartedServer {
    spec: ServerSpec;
    child: ChildProcess;
    /** The server's own output, last part only, for the message when it fails to start. */
    output: () => string;
}

const STOP_GRACE_MS = 30_000;
const OUTPUT_KEPT = 4000;

/** Every server started and not yet stopped, so an interrupt or a crash can stop them all (stopAllServers). */
const running = new Set<StartedServer>();

function answersOn(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = connect({ host, port });
        const done = (answered: boolean) => {
            socket.destroy();
            resolve(answered);
        };
        socket.setTimeout(timeoutMs, () => done(false));
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
    });
}

/** True when something accepts a connection on localhost:<port>, over IPv4 or IPv6. */
export async function portAnswers(port: number, timeoutMs = 1000): Promise<boolean> {
    return (await answersOn("127.0.0.1", port, timeoutMs)) || answersOn("::1", port, timeoutMs);
}

function startOne(spec: ServerSpec): StartedServer {
    // A shell, so the command is written as it would be typed; detached on POSIX, so its group can be signalled.
    const child = spawn(spec.command, {
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
        detached: process.platform !== "win32",
        windowsHide: true,
    });
    let output = "";
    const keep = (chunk: Buffer) => {
        output = (output + chunk.toString("utf8")).slice(-OUTPUT_KEPT);
    };
    child.stdout?.on("data", keep);
    child.stderr?.on("data", keep);
    child.on("error", (error) => keep(Buffer.from(`${error.message}\n`)));
    // Closing stdin to stop a server that has already exited is EPIPE: nothing to report, and never a crash.
    child.stdin?.on("error", () => { });
    const server = { spec, child, output: () => output };
    running.add(server);
    return server;
}

const exited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (exited(child)) return Promise.resolve(true);
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(exited(child)), timeoutMs);
        child.once("exit", () => {
            clearTimeout(timer);
            resolve(true);
        });
    });
}

function killTree(child: ChildProcess) {
    if (child.pid === undefined) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
        try {
            process.kill(-child.pid, "SIGKILL");
        } catch {
            // already gone
        }
    }
}

/** Stops every server: gently, then, after the grace period, by killing each one's whole process tree. */
export async function stopServers(servers: StartedServer[], graceMs = STOP_GRACE_MS) {
    await Promise.all(servers.map(async (server) => {
        const { child } = server;
        child.stdin?.end();
        if (process.platform !== "win32" && child.pid !== undefined) {
            try {
                process.kill(-child.pid, "SIGTERM");
            } catch {
                // already gone
            }
        }
        await waitForExit(child, graceMs);
        // Its tree: on POSIX its whole process group, even once the shell has exited; on Windows, what is still
        // below the shell (taskkill finds no tree under a shell that has already exited).
        killTree(child);
        // A killed process is gone only once the system has ended it, not when the signal is sent: on 2-core Linux the
        // port still answered at +0 ms and was free by +100 ms (Cowork, 2026-11-08). Bounded, so a stop never hangs.
        await waitUntilGone(child, GONE_LIMIT_MS);
        running.delete(server);
    }));
}

const GONE_LIMIT_MS = 5_000;

/** True while any process of the server is left: on POSIX its process group, on Windows the shell itself. */
function stillThere(child: ChildProcess) {
    if (child.pid === undefined) return false;
    if (process.platform === "win32") return !exited(child);
    try {
        process.kill(-child.pid, 0);
        return true;
    } catch (error) {
        // ESRCH: no process is left in the group. EPERM would mean one is, under another user.
        return (error as NodeJS.ErrnoException).code === "EPERM";
    }
}

async function waitUntilGone(child: ChildProcess, limitMs: number) {
    const deadline = Date.now() + limitMs;
    while (stillThere(child) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
}

/** Stops every server still running, wherever it was started: on an interrupt or a crash (main.ts). */
export function stopAllServers(graceMs = STOP_GRACE_MS) {
    return stopServers([...running], graceMs);
}

/**
 * Starts each server in order and waits until its port answers. A server that exits, or doesn't answer within the
 * timeout, stops all of them (this one included) and throws a ServerStartError naming it: the run couldn't run.
 */
export async function startServers(specs: ServerSpec[], timeoutMs: number, onLine: (line: string) => void = () => { }, graceMs = STOP_GRACE_MS): Promise<StartedServer[]> {
    const started: StartedServer[] = [];
    for (const spec of specs) {
        // Something already on the port would be tested in the server's place.
        if (await portAnswers(spec.port)) {
            await stopServers(started, graceMs);
            throw new ServerStartError(`The server "${spec.command}" couldn't start: port ${spec.port} is already in use, so TestForge would test whatever holds it.`);
        }
        const server = startOne(spec);
        started.push(server);
        onLine(`Starting server: ${spec.command} (waiting for port ${spec.port})`);
        const deadline = Date.now() + timeoutMs;
        let answered = false;
        while (Date.now() < deadline && !exited(server.child)) {
            if (await portAnswers(spec.port)) {
                answered = true;
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!answered) {
            const why = exited(server.child)
                ? `it exited (code ${server.child.exitCode ?? server.child.signalCode}) before port ${spec.port} answered`
                : `port ${spec.port} didn't answer within ${Math.round(timeoutMs / 1000)} s`;
            await stopServers(started, graceMs);
            const tail = server.output().trim().split("\n").slice(-5).join("\n");
            throw new ServerStartError(`The server "${spec.command}" couldn't start: ${why}.${tail ? `\nIts last output:\n${tail}` : ""}`);
        }
        onLine(`Server ready on port ${spec.port}.`);
    }
    return started;
}
