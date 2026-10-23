// Runs a Prisma command against TEST_DATABASE_URL:  node scripts/test-db.mjs migrate deploy
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env" });
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}
// On Windows `npx` is `npx.cmd`, which Node only runs through a shell; without it the spawn fails silently (exit 1).
const res = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
  shell: process.platform === "win32",
});
if (res.error) console.error(`Could not run prisma: ${res.error.message}`);
process.exit(res.status ?? 1);
