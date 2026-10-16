import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "telemedicine-consent-dialog.spec.ts",
  workers: 1,
  timeout: 30_000,
  use: { browserName: "chromium", headless: true },
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 640 } } },
    { name: "mobile-375", use: { viewport: { width: 375, height: 812 } } }
  ]
});
