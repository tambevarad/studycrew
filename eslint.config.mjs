import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / tooling output
    "src/generated/**",
    "coverage/**",
    "cypress/videos/**",
    "cypress/screenshots/**",
  ]),
  {
    rules: {
      // Architecture guard: UI never touches the database directly (docs/contracts/00-architecture.md).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma/client", "@/server/db"],
              importNames: ["PrismaClient", "db"],
              message: "Only src/server/** may use the database. Call a service instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/server/**", "prisma/**", "tests/**"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
