import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { setting } from "./src/lib/settings";

export default defineConfig({
    testDir: "tests/smoke",
    timeout: 180_000,
    expect: {
        timeout: 15_000,
    },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [
        ["line"],
        [
            "allure-playwright",
            {
                resultsDir: "artifacts/allure-results/smoke",
                detail: true,
                suiteTitle: true,
                environmentInfo: {
                    os_platform: os.platform(),
                    os_release: os.release(),
                    node_version: process.version,
                    suite: "smoke",
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
        // Phase 48 (TFP-277): the server under test gets a temporary data folder, as the regression one does (TFP-190).
        // Before, it used the real one, and from TFP-277 resolving the real default can move a 0.2.x folder.
        // Set on this process too, so the workers that evaluate this config again reuse the one folder.
        env: { MRONION_DATA_DIR: setting("DATA_DIR") || (process.env.MRONION_DATA_DIR = mkdtempSync(join(os.tmpdir(), "mr-onion-self-test-data-"))) },
    },
});