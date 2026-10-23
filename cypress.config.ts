import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
  },
});
