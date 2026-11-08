/**
 * Phase 47 (TFP-245): an interrupt, a cancelled job or a crash stops every server `--server` started, then exits 2
 * ("couldn't run"), never Node's 1 for an uncaught error, which would read as "a test failed".
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/exit.test.ts
 */
import assert from "node:assert/strict";
import { createServer, type AddressInfo } from "node:net";
import { test } from "node:test";
import { exitHandler } from "./exit.ts";
import { portAnswers, startServers } from "./servers.ts";

async function freePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

test("an interrupt stops the servers it started before exiting 2, and a second one doesn't exit twice", async () => {
    const port = await freePort();
    await startServers([{ command: `"${process.execPath}" -e "require('net').createServer(s => s.destroy()).listen(${port}, '127.0.0.1')"`, port }], 15_000);
    assert.equal(await portAnswers(port), true);

    const exits: number[] = [];
    const lines: string[] = [];
    const end = exitHandler((code) => exits.push(code), (line) => lines.push(line), 2_000);
    const first = end("stopped by SIGINT");
    const second = end("stopped by SIGINT");
    await Promise.all([first, second]);

    assert.equal(await portAnswers(port), false, "the server was stopped before the exit");
    assert.deepEqual(exits, [2]);
    assert.deepEqual(lines, ["testforge: stopped by SIGINT; stopping the server(s) it started."]);
});
