/**
 * Phase 47 Decision 2, amended (TFP-245): `--server` starts each command and waits for its port; one that never
 * answers ends the run, and every server is stopped afterwards, leaving nothing running or listening.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/servers.test.ts
 */
import assert from "node:assert/strict";
import { createServer, type AddressInfo } from "node:net";
import { test } from "node:test";
import { portAnswers, ServerStartError, startServers, stopAllServers, stopServers } from "./servers.ts";

/** A port nothing listens on: the OS hands one out, and it is closed again at once. */
async function freePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

const node = (script: string) => `"${process.execPath}" -e "${script}"`;
const listener = (port: number) => node(`require('net').createServer(s => s.destroy()).listen(${port}, '127.0.0.1')`);

function alive(pid: number | undefined) {
    if (pid === undefined) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

test("a server is started, answers on its port, and once stopped nothing listens or runs", async () => {
    const [first, second] = [await freePort(), await freePort()];
    const lines: string[] = [];
    const servers = await startServers([{ command: listener(first), port: first }, { command: listener(second), port: second }], 15_000, (line) => lines.push(line));
    assert.equal(await portAnswers(first), true);
    assert.equal(await portAnswers(second), true);
    assert.deepEqual(lines.filter((line) => line.startsWith("Server ready")), [`Server ready on port ${first}.`, `Server ready on port ${second}.`]);

    await stopServers(servers, 2_000);
    assert.equal(await portAnswers(first), false, "the first server's port is free again");
    assert.equal(await portAnswers(second), false, "the second server's port is free again");
    assert.deepEqual(servers.map((server) => alive(server.child.pid)), [false, false]);
});

test("a server that never opens its port ends with a ServerStartError naming it, and is stopped", async () => {
    const port = await freePort();
    const started = Date.now();
    await assert.rejects(
        startServers([{ command: node("setInterval(() => {}, 1000)"), port }], 1_500, undefined, 2_000),
        (error: unknown) => error instanceof ServerStartError && error.message.includes(`port ${port} didn't answer within 2 s`)
    );
    assert.ok(Date.now() - started < 30_000);
    assert.equal(await portAnswers(port), false);
});

test("a server that exits before its port answers is named with its exit code and last output", async () => {
    const port = await freePort();
    await assert.rejects(
        startServers([{ command: node("console.error('no database'); process.exit(3)"), port }], 15_000, undefined, 2_000),
        (error: unknown) => error instanceof ServerStartError && /exited \(code 3\)/.test(error.message) && error.message.includes("no database")
    );
});

test("stopAllServers stops every server still running, without the list startServers returned (an interrupt's path)", async () => {
    const port = await freePort();
    await startServers([{ command: listener(port), port }], 15_000);
    assert.equal(await portAnswers(port), true);
    await stopAllServers(2_000);
    assert.equal(await portAnswers(port), false);
});

test("a server listening only on IPv6 loopback answers", async (t) => {
    const port = await freePort();
    const v6 = createServer((socket) => socket.destroy());
    // Where ::1 can't be bound (no IPv6 loopback: EAFNOSUPPORT, EADDRNOTAVAIL), there is nothing to check.
    const bound = await new Promise<string | null>((resolve) => {
        v6.once("error", (error: NodeJS.ErrnoException) => resolve(error.code ?? error.message));
        v6.listen(port, "::1", () => resolve(null));
    });
    if (bound === "EAFNOSUPPORT" || bound === "EADDRNOTAVAIL") {
        t.skip(`IPv6 loopback ::1 can't be bound on this machine (${bound})`);
        return;
    }
    assert.equal(bound, null, "::1 was refused for another reason than having no IPv6 loopback");
    try {
        assert.equal(await portAnswers(port), true);
    } finally {
        await new Promise((resolve) => v6.close(resolve));
    }
});

test("a port already in use is refused before anything starts, and the servers started before it are stopped", async () => {
    const [free, taken] = [await freePort(), await freePort()];
    const holder = createServer((socket) => socket.destroy());
    await new Promise<void>((resolve) => holder.listen(taken, "127.0.0.1", resolve));
    try {
        await assert.rejects(
            startServers([{ command: listener(free), port: free }, { command: listener(taken), port: taken }], 15_000, undefined, 2_000),
            (error: unknown) => error instanceof ServerStartError && error.message.includes(`port ${taken} is already in use`)
        );
        assert.equal(await portAnswers(free), false, "the server started first was stopped");
    } finally {
        await new Promise((resolve) => holder.close(resolve));
    }
});
