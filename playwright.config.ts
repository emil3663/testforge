import { defineConfig } from "@playwright/test";
import { RUN_CONTEXT_OPTIONS } from "./src/lib/run/browser-context";

export default defineConfig({
  testDir: ".playwright-runs",
  timeout: 30_000,
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  use: {
    headless: true,
    // TFP-092: set by the executor to this run's own login state when the run
    // asked for a login, otherwise removed from the environment - so every
    // test in an authenticated run starts signed in, and nothing else does.
    storageState: process.env.TESTFORGE_STORAGE_STATE || undefined,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "line",
  projects: [
    {
      name: "chromium",
      // Shared with the run's login (src/lib/run/auth.ts) on purpose - see
      // browser-context.ts.
      use: {
        ...RUN_CONTEXT_OPTIONS,
      },
    },
  ],
});
