/**
 * TFP-142: the hover-state and HTTPS/SSL link checks must not hang for the
 * whole 30 s test timeout. On rizonetech.com (run 5ce88c9c) the hover check
 * timed out on 5 of 5 pages - hover() retried forever on a skip link parked
 * off-screen - and the HTTPS/SSL check on 3, requesting every link in turn at
 * 15 s each. Each now has its own bounds, and what it could not check is a
 * named finding with the reason, not a 30 s failure.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/link-check-timeouts.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import { createServer as createTcpServer, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { LinkDetail } from "../types.ts";

const { buildLinkExperienceTests } = await import("./experience-tests.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

function secureLink(url: string): LinkDetail {
    return { text: url, url, rawHref: url, category: "navigation" as never, linkType: "external", containerLabel: "", expectedStatus: null, isVisible: true, target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: true };
}

function pick(tests: string[], title: string) {
    const found = tests.filter((t) => t.includes(title));
    assert.equal(found.length, 1, title);
    return found[0];
}

const hoverTest = (path: string) => pick(buildLinkExperienceTests(path, true, false, [], "[]", [], [], []), "hover state:");
const httpsTest = (links: LinkDetail[]) => pick(buildLinkExperienceTests("/", false, false, [], "[]", links, [], []), "HTTPS/SSL:");

test("both generated checks type-check and bound their own waits", () => {
    for (const code of [hoverTest("/"), httpsTest([secureLink("https://a.test/")])]) {
        assert.deepEqual(findTypeErrors(`import { test, expect } from '@playwright/test';\n${code}\n`), []);
    }
    assert.match(hoverTest("/"), /hover\(\{ timeout: 2000 \}\)/);
    assert.match(httpsTest([secureLink("https://a.test/")]), /timeout: 5000/);
});

/** Runs one generated test through the Playwright CLI, returning its outcome, duration, message and findings. */
async function runGenerated(code: string, baseURL: string) {
    const { report } = await runPlaywrightSpec(`import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\n${code}\n`, `timeouts-unit`, ["--workers=1"]);
    const [record] = flattenSuites(report.suites);
    return { status: record.status, duration: record.duration, message: record.rawMessage, findings: record.findings ?? [] };
}

test("in a real browser: a skip link parked off-screen is named as not hovered; the check passes in seconds, not 30 s", { skip: needsChromium }, async () => {
    const server = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html" }).end(
            `<!doctype html><title>t</title><a href="#content" style="position:absolute;left:-9999px;top:0">Skip to content</a><a href="/a">A</a> <a href="/b">B</a><main id="content">Text</main>`
        );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const result = await runGenerated(hoverTest("/"), `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
        assert.equal(result.status, "Passed", result.message);
        assert.ok(result.duration < 15000, `took ${result.duration} ms`);
        assert.deepEqual(result.findings, ["links that could not be hovered, so their cursor was not checked: #content (outside of the viewport)"]);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test("in a real browser: a stalled dependency is the check's own 5 s timeout, named with its reason; a repeat of it is not requested again", { skip: needsChromium }, async () => {
    // Accepts connections and never answers: a TLS handshake to it stalls.
    const sockets: Socket[] = [];
    const stalled = createTcpServer((socket) => { sockets.push(socket); });
    await new Promise<void>((resolve) => stalled.listen(0, "127.0.0.1", resolve));
    const url = `https://127.0.0.1:${(stalled.address() as AddressInfo).port}/slow`;
    try {
        const result = await runGenerated(httpsTest([secureLink(url), secureLink(url), secureLink("https://no-such-host.invalid/")]), "http://127.0.0.1:9");
        assert.equal(result.status, "Passed", result.message);
        assert.ok(result.duration < 15000, `took ${result.duration} ms - the repeat must not be requested again`);
        assert.equal(result.findings.length, 1);
        assert.match(result.findings[0], new RegExp(`^secure links that could not be reached, so their HTTPS was not checked: ${url.replace(/[.]/g, "[.]")} \\(no answer within 5 s\\), https://no-such-host[.]invalid/ \\(`));
        assert.ok(sockets.length <= 2, `the stalled URL was requested ${sockets.length} times`);
    } finally {
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => stalled.close(() => resolve()));
    }
});
