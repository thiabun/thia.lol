import { defineConfig, devices } from "@playwright/test";
import { applySmokeTestConfigToEnv } from "./tests/test-config";

applySmokeTestConfigToEnv();

const baseURL = process.env.THIA_BASE_URL ?? "http://localhost:5173";
const shouldStartWebServer =
  process.env.PLAYWRIGHT_NO_WEBSERVER !== "1" &&
  process.env.THIA_BASE_URL === undefined;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev -- --host 127.0.0.1",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
