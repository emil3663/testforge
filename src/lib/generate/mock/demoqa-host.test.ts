/**
 * TFP-267 (CodeQL alert #10): which hosts get the DemoQA suites. `hostname.includes("demoqa.com")` also matched a host
 * that merely contains the name.
 *
 * ISTQB technique: equivalence partitioning of the host (the site, a host under it, one that contains the name).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/demoqa-host.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { isDemoQaHost } = await import("./demoqa-suites.ts");

test("the site and the hosts under it are DemoQA", () => {
    for (const host of ["demoqa.com", "www.demoqa.com", "a.b.demoqa.com"]) assert.equal(isDemoQaHost(host), true, host);
});

test("a host that merely contains the name isn't", () => {
    for (const host of ["demoqa.com.example", "notdemoqa.com", "demoqa.community", "demoqa.com.evil.test", "example.com"]) assert.equal(isDemoQaHost(host), false, host);
});
