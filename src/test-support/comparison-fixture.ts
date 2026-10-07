import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";

export interface RecordedRequest {
    method: string;
    path: string;
    bodyBytes: number;
}

async function freePort() {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return port;
}

/**
 * Phase 38 (TFP-146): the comparison fixture (scripts/comparison-fixture.mjs)
 * on a free port, behind a proxy that records every request it forwards -
 * method, path and body size - so a test can prove what a run sent. The
 * fixture's own control endpoints are called on its port directly, never
 * through the proxy, so they are not recorded. close() stops the fixture
 * process this started (by its handle) and the proxy.
 */
export async function startRecordedFixture() {
    const fixturePort = await freePort();
    const fixture = spawn(process.execPath, [join(process.cwd(), "scripts", "comparison-fixture.mjs"), "--port", String(fixturePort)], {
        cwd: process.cwd(),
        // TFP-169: the fixture's errors are kept, so a fixture that dies says why instead of leaving a bare ECONNRESET.
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
    });
    let errors = "";
    fixture.stderr?.on("data", (chunk: Buffer) => {
        errors = (errors + chunk.toString()).slice(-4000);
    });
    let exited: string | null = null;
    fixture.on("exit", (code, signal) => {
        exited = `exit code ${code ?? "none"}${signal ? `, signal ${signal}` : ""}`;
    });
    const startedAt = Date.now();
    const control = (path: string) => fetch(`http://127.0.0.1:${fixturePort}${path}`).then((response) => response.json(), (error: unknown) => {
        const cause = error instanceof Error ? `${error.message}${error.cause instanceof Error ? `: ${error.cause.message}` : ""}` : String(error);
        throw new Error(exited
            ? `the comparison fixture on port ${fixturePort} has exited (${exited}), ${Date.now() - startedAt} ms after it started; control ${path}: ${cause}; its error output: ${errors.trim() || "none"}`
            : `control ${path} to the comparison fixture on port ${fixturePort} (pid ${fixture.pid}, still running) failed ${Date.now() - startedAt} ms after it started: ${cause}`, { cause: error });
    });
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
        ready = await control("/__fixture/reset").then(() => true, () => new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100)));
    }
    if (!ready) {
        fixture.kill();
        throw new Error(`the comparison fixture did not start on port ${fixturePort}`);
    }

    const recorded: RecordedRequest[] = [];
    const proxy = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
            const body = Buffer.concat(chunks);
            recorded.push({ method: req.method ?? "", path: req.url ?? "", bodyBytes: body.length });
            const upstream = httpRequest({ host: "127.0.0.1", port: fixturePort, method: req.method, path: req.url, headers: req.headers }, (response) => {
                res.writeHead(response.statusCode ?? 502, response.headers);
                response.pipe(res);
            });
            upstream.on("error", () => res.writeHead(502).end());
            upstream.end(body);
        });
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));

    return {
        origin: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
        recorded,
        control,
        close: async () => {
            proxy.closeAllConnections();
            await new Promise<void>((resolve) => proxy.close(() => resolve()));
            fixture.kill();
        },
    };
}
