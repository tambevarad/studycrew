/**
 * Runs before every integration test file. Points Prisma at the TEST database and
 * wipes it before each test so tests never depend on each other or on seed data.
 */
import { config } from "dotenv";
import { afterAll, beforeEach, vi } from "vitest";

config({ path: ".env" });
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://studycrew:studycrew@localhost:5432/studycrew_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";

// next/headers is only available inside a request; route tests mock the session instead.
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));

const { resetDb } = await import("./db");
const { db } = await import("@/server/db");

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.$disconnect();
});
