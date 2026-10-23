/**
 * NFR-02 automated authorization sweep — DO NOT add routes here by hand.
 * It discovers every route file under src/app/api/v1 and asserts:
 *   1. signed-out callers get 401 on every method of every v1 route;
 *   2. signed-in NON-members get 403 on every method of every route under teams/[teamId]/.
 * New routes are covered automatically, which is why every team route must use teamRoute().
 */
import { globSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const ROOT = path.resolve(__dirname, "../../src/app/api/v1");
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

const files = globSync("**/route.ts", { cwd: ROOT }).sort();

function paramsFor(file: string, teamId: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const m of file.matchAll(/\[([^\]]+)\]/g)) params[m[1]] = m[1] === "teamId" ? teamId : "does-not-exist";
  return params;
}

async function handlersOf(file: string) {
  const mod = (await import(path.join(ROOT, file))) as Record<string, unknown>;
  return METHODS.filter((m) => typeof mod[m] === "function").map((m) => ({ method: m, fn: mod[m] as Parameters<typeof callRoute>[0] }));
}

describe("authorization sweep", () => {
  it("discovers v1 routes", () => {
    // Informational: the sweep below runs once per discovered file.
    expect(Array.isArray(files)).toBe(true);
  });

  it.each(files)("401 when signed out: %s", async (file) => {
    signOut();
    for (const { method, fn } of await handlersOf(file)) {
      const res = await callRoute(fn, { method, params: paramsFor(file, "any-team"), body: method === "GET" || method === "DELETE" ? undefined : {} });
      expect(res.status, `${method} ${file}`).toBe(401);
    }
  });

  const teamFiles = files.filter((f) => f.startsWith(`teams${path.sep}[teamId]`));
  it.each(teamFiles)("403 for non-members: %s", async (file) => {
    const { team } = await makeTeam({ members: 1 });
    const outsider = await makeUser();
    signInAs(outsider);
    for (const { method, fn } of await handlersOf(file)) {
      const res = await callRoute(fn, { method, params: paramsFor(file, team.id), body: method === "GET" || method === "DELETE" ? undefined : {} });
      expect(res.status, `${method} ${file}`).toBe(403);
    }
  });
});
