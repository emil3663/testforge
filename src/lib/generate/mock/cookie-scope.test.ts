/**
 * TFP-144: the Standard security check and the Comprehensive passive-security
 * check must flag the same cookies for missing HttpOnly/Secure. On
 * rizonetech.com (2026-10-01) the Standard check named 6 cookies and passive
 * security none: the Standard check took every cookie the site set, passive
 * security only those named like a session. Both now take the session-named
 * ones (SESSION_COOKIE_NAME).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/cookie-scope.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { JsonReport } from "../../report/types.ts";

const { buildSecurityChecks } = await import("./security-checks.ts");
const { passiveSecurityPageTests } = await import("../comprehensive-security.ts");
const { PASSIVE_SECURITY_HELPERS } = await import("../comprehensive-security-helpers.ts");
const { findTypeErrors } = await import("../validate.ts");
const { flattenSuites } = await import("../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

function standardCookieTest() {
    const found = buildSecurityChecks("http://127.0.0.1:1", null).tests.filter((t) => t.includes("cookies set by the site carry protective flags"));
    assert.equal(found.length, 1);
    return found[0];
}

function passiveCookieTest(path: string) {
    const found = passiveSecurityPageTests({ escapedPath: path, details: () => "{ annotation: [] }" }).filter((t) => t.includes("sends its security headers and session cookies"));
    assert.equal(found.length, 1);
    return `${PASSIVE_SECURITY_HELPERS}\n${found[0]}`;
}

/** The cookies a finding names as missing HttpOnly or Secure. */
function flaggedCookies(findings: string[]) {
    return findings.filter((f) => /HttpOnly|Secure/.test(f)).map((f) => (/cookie "([^"]+)"/.exec(f) ?? [])[1]).sort();
}

test("the Standard cookie check type-checks and takes the passive check's session-cookie rule", () => {
    const code = standardCookieTest();
    assert.deepEqual(findTypeErrors(`import { test, expect } from '@playwright/test';\n${code}\n`), []);
    assert.match(code, /sessionCookies = own\.filter\(\(cookie\) => sessionName\.test\(cookie\.name\)\)/);
});

/** Runs one generated test through the Playwright CLI, returning its outcome, message and findings. */
async function runGenerated(code: string, baseURL: string) {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `cookie-scope-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\n${code}\n`, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        const [record] = flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
        return { status: record.status, message: record.status === "Not run" ? (record.skipReason ?? "") : record.rawMessage, findings: record.findings ?? [] };
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

test("in a real browser: on a page with a session cookie and two that are not, none with HttpOnly, both checks name the same one", { skip: needsChromium }, async () => {
    const cookies = ["sid=acme-4f9c2a1e7b; Path=/", "_ga=GA1.1.1234567890; Path=/", "theme=dark; Path=/"];
    const server = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", "set-cookie": cookies }).end("<!doctype html><title>t</title><p>Home</p>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const standard = await runGenerated(standardCookieTest(), origin);
        const passive = await runGenerated(passiveCookieTest("/"), origin);
        assert.equal(standard.status, "Passed", standard.message);
        assert.equal(passive.status, "Passed", passive.message);
        assert.deepEqual(flaggedCookies(standard.findings), ["sid"]);
        assert.deepEqual(flaggedCookies(passive.findings), ["sid"]);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test("in a real browser: with no session-named cookie the Standard check is Not run with its reason, not passed having checked nothing", { skip: needsChromium }, async () => {
    const server = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", "set-cookie": ["_ga=GA1.1.1234567890; Path=/"] }).end("<!doctype html><title>t</title><p>Home</p>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const result = await runGenerated(standardCookieTest(), `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
        assert.equal(result.status, "Not run");
        assert.match(result.message, /no session cookie on the landing page \(1 cookie\(s\) set by the site, none named like a session\)/);
        assert.deepEqual(result.findings, []);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
