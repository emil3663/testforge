import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".playwright-runs",
  timeout: 30_000,
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  outputDir: process.env.TESTFORGE_PLAYWRIGHT_OUTPUT_DIR,
  use: {
    headless: true,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "line",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
      },
    },
  ],
});
