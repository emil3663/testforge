/**
 * napi is off unless configured (docs/NAPI.md): the four variables, or nothing
 * is attempted. Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/napi/config.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { readNapiConfig } from "./config.ts";

const FULL = { NAPI_URL: "http://napi.local:8100/", NAPI_CLIENT_ID: "id", NAPI_CLIENT_SECRET: "secret", NAPI_COMPANY_ID: "c0mp4ny" };

test("unset, or any one of the four missing, means off", () => {
    assert.equal(readNapiConfig({}), null);
    for (const key of Object.keys(FULL)) {
        const env = { ...FULL } as Record<string, string>;
        delete env[key];
        assert.equal(readNapiConfig(env), null, `${key} missing`);
    }
    assert.equal(readNapiConfig({ ...FULL, NAPI_CLIENT_SECRET: "   " }), null, "blank is missing");
});

test("configured: trailing slashes go, the poll interval defaults to 30s and 0 turns the poller off", () => {
    const config = readNapiConfig(FULL);
    assert.ok(config);
    assert.equal(config.url, "http://napi.local:8100");
    assert.equal(config.companyId, "c0mp4ny");
    assert.equal(config.pollSeconds, 30);
    assert.equal(config.selfUrl, "http://127.0.0.1:3000");
    assert.equal(readNapiConfig({ ...FULL, NAPI_POLL_SECONDS: "0" })?.pollSeconds, 0);
    assert.equal(readNapiConfig({ ...FULL, NAPI_POLL_SECONDS: "nonsense" })?.pollSeconds, 0);
    assert.equal(readNapiConfig({ ...FULL, NEXT_PUBLIC_SITE_URL: "http://localhost:3001/" })?.selfUrl, "http://localhost:3001");
    assert.equal(readNapiConfig({ ...FULL, TESTFORGE_SELF_URL: "http://tf:4000", NEXT_PUBLIC_SITE_URL: "http://x" })?.selfUrl, "http://tf:4000");
});
