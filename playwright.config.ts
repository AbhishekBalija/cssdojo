import { defineConfig } from "@playwright/test";

// End-to-end tests run against a running app. Locally that is `docker compose up`
// (http://localhost:8787). CI sets E2E_BASE_URL to the container it started.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8787",
    trace: "retain-on-failure",
  },
});
