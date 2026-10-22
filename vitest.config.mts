import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // `server-only` throws outside the React server runtime; it is a no-op under test.
  "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/contracts/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/server/ai/providers/**", "src/**/*.d.ts", "src/lib/auth-client.ts", "src/lib/use-api-action.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      // NFR-06: ≥ 70% line coverage on service and library code. CI fails below this.
      thresholds: { lines: 70 },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/helpers/integration-setup.ts"],
          // One shared test database → run files one at a time.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
