import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { AUTH_FIXTURE_ENV } from "./tests/regression/auth-fixture";

export default defineConfig({
    testDir: "tests/regression",
    timeout: 240_000,
    expect: {
        timeout: 20_000,
    },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [
        ["line"],
        [
            "allure-playwright",
            {
                resultsDir: "artifacts/allure-results/regression",
                detail: true,
                suiteTitle: true,
                environmentInfo: {
                    os_platform: os.platform(),
                    os_release: os.release(),
                    node_version: process.version,
                    suite: "regression",
                },
            },
        ],
    ],
    use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3001",
        headless: true,
    },
    webServer: {
        command: "npm run serve:self-test",
        url: "http://127.0.0.1:3001",
        reuseExistingServer: false,
        timeout: 120_000,
        // Phase 20: test-only credentials for tests/regression/auth-fixture.ts.
        // A credential only ever reaches TestForge as an environment variable.
        // Phase 42 (TFP-190): site suites are saved in TestForge's data folder; the
        // server under test gets a temporary one outside the repo, never the real one.
        env: { ...AUTH_FIXTURE_ENV, TESTFORGE_DATA_DIR: process.env.TESTFORGE_DATA_DIR || mkdtempSync(join(os.tmpdir(), "testforge-regression-data-")) },
    },
});