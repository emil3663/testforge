import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "tests",
    timeout: 180_000,
    expect: {
        timeout: 15_000,
    },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: "line",
    use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3001",
        headless: true,
    },
    webServer: {
        command: "npm run serve:self-test",
        url: "http://127.0.0.1:3001",
        reuseExistingServer: true,
        timeout: 120_000,
    },
});