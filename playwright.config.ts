import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "python3 -m http.server 4173 --directory .",
    url: "http://127.0.0.1:4173/tests/e2e/runtime-harness.html",
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"]
  }
});
