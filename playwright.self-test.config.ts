import { defineConfig, devices } from "@playwright/test";
import os from "node:os";

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
    },
});