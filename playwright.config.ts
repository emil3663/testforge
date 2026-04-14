import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".playwright-runs",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
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
