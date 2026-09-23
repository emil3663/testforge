/**
 * Tests that next.config.ts's CSP script-src drops 'unsafe-eval' in
 * production while keeping it in dev mode (TFP-069, Phase 24 reliability
 * audit). 'unsafe-eval' is a dev-mode/HMR requirement, not a production one.
 *
 * next.config.ts reads process.env.NODE_ENV once at module-evaluation time,
 * so testing both branches in one process (importing twice) would just
 * return the same cached module. Each case is run in its own child process
 * with NODE_ENV set before import - matching how Next.js itself sets
 * NODE_ENV per command (dev vs build/start).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test next.config.test.ts
 */
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

const PROBE = `
import("./next.config.ts").then(async (m) => {
  const headers = await m.default.headers();
  const csp = headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
  process.stdout.write(csp);
});
`;

function getCsp(nodeEnv: "development" | "production"): string {
    return execFileSync(
        process.execPath,
        [
            "--import",
            "./scripts/register-node-test-ts-resolver.mjs",
            "--experimental-strip-types",
            "-e",
            PROBE,
        ],
        {
            cwd: import.meta.dirname,
            env: { ...process.env, NODE_ENV: nodeEnv },
            encoding: "utf8",
        }
    );
}

test("production CSP drops 'unsafe-eval' from script-src", () => {
    const csp = getCsp("production");
    const scriptSrc = csp.split("; ").find((part) => part.startsWith("script-src"));

    assert.ok(scriptSrc, "script-src directive must be present");
    assert.ok(!csp.includes("unsafe-eval"), `production CSP must not include unsafe-eval: ${scriptSrc}`);
    assert.ok(scriptSrc!.includes("'self'"), "production script-src must still allow 'self'");
});

test("dev-mode CSP still includes 'unsafe-eval' (required by HMR)", () => {
    const csp = getCsp("development");
    const scriptSrc = csp.split("; ").find((part) => part.startsWith("script-src"));

    assert.ok(scriptSrc, "script-src directive must be present");
    assert.ok(csp.includes("unsafe-eval"), `dev CSP must still include unsafe-eval: ${scriptSrc}`);
});
