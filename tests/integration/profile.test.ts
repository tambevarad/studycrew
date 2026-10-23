import { describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/v1/me/profile/route";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getProfile, updateProfile } from "@/server/services/profile/service";
import { makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const patch = (body: unknown) => callRoute(PATCH, { method: "PATCH", body });

describe("PB-02 profile service", () => {
  it("returns the profile with ISO dates and 404s for a missing user", async () => {
    const user = await makeUser({ name: "Ana", courses: ["CSE 6324"] });
    const profile = await getProfile(user.id);
    expect(profile).toMatchObject({ id: user.id, name: "Ana", courses: ["CSE 6324"], skills: [], bio: null });
    expect(profile.createdAt).toBe(user.createdAt.toISOString());
    await expect(getProfile("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateProfile("missing", { name: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only changes the fields that are sent and stores an empty bio as null", async () => {
    const user = await makeUser({ name: "Ana", courses: ["CSE 6324"] });
    await updateProfile(user.id, { bio: "Hi" });
    const updated = await updateProfile(user.id, { bio: "   " });
    expect(updated).toMatchObject({ name: "Ana", courses: ["CSE 6324"], bio: null });
  });
});

describe("PB-02 /api/v1/me/profile", () => {
  it("returns 401 when signed out", async () => {
    signOut();
    expect((await callRoute(GET)).status).toBe(401);
    expect((await patch({ name: "x" })).status).toBe(401);
  });

  it("GET returns my own profile", async () => {
    const user = await makeUser({ name: "Ana" });
    signInAs(user);
    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ id: user.id, email: user.email, timezone: "America/Chicago" });
  });

  it("AC5: courses `cse6324` and `CSE 6324` are stored as one course “CSE 6324”", async () => {
    const user = await makeUser({ courses: [] });
    signInAs(user);
    const res = await patch({ courses: ["cse6324", "CSE 6324", "cse 5311"], skills: ["Testing", "testing ", "UI"] });
    expect(res.status).toBe(200);
    expect(res.json.data.courses).toEqual(["CSE 6324", "CSE 5311"]);
    expect(res.json.data.skills).toEqual(["Testing", "UI"]);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).courses).toEqual(["CSE 6324", "CSE 5311"]);
  });

  it("AC6: a saved time zone is returned by GET", async () => {
    const user = await makeUser();
    signInAs(user);
    expect((await patch({ timezone: "Asia/Kolkata", name: "  Ana Lee  " })).status).toBe(200);
    const res = await callRoute(GET);
    expect(res.json.data).toMatchObject({ timezone: "Asia/Kolkata", name: "Ana Lee" });
  });

  it("AC7: empty name, 21 skills, and a bad time zone return 400 with field errors", async () => {
    const user = await makeUser({ name: "Ana" });
    signInAs(user);
    const res = await patch({
      name: "  ",
      skills: Array.from({ length: 21 }, (_, i) => `Skill ${i}`),
      timezone: "Mars/Olympus_Mons",
    });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("VALIDATION");
    expect(res.json.error.details.fields).toMatchObject({
      name: "Enter your name.",
      skills: "Add at most 20 skills.",
      timezone: "Choose a valid time zone.",
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe("Ana");
  });

  it("ignores attempts to change the email", async () => {
    const user = await makeUser();
    signInAs(user);
    const res = await patch({ email: "someone-else@test.local", name: "Ana" });
    expect(res.status).toBe(200);
    expect(res.json.data.email).toBe(user.email);
  });
});

describe("PB-02 accounts (Better Auth)", () => {
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const signUp = (email: string, password = "correct-horse-1") =>
    auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ name: "New Student", email, password, timezone: "America/New_York" }),
      }),
    );

  it("AC1/AC8: sign-up stores only a password hash and sets an HttpOnly, SameSite=Lax session cookie", async () => {
    const email = `new-${Date.now()}@test.local`;
    const res = await signUp(email);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { accounts: true } });
    expect(user.timezone).toBe("America/New_York");
    const stored = user.accounts[0].password ?? "";
    expect(stored).not.toBe("correct-horse-1");
    expect(stored).not.toContain("correct-horse-1");
    expect(stored.length).toBeGreaterThan(40);
  });

  it("AC2: signing up with an existing email fails and creates no second account", async () => {
    const email = `dupe-${Date.now()}@test.local`;
    expect((await signUp(email)).status).toBe(200);
    const again = await signUp(email, "another-pass-2");
    expect(again.status).toBeGreaterThanOrEqual(400);
    const body = (await again.json()) as { code?: string };
    expect(body.code).toMatch(/^USER_ALREADY_EXISTS/);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it("AC3: a wrong password is rejected and the right one signs in", async () => {
    const email = `signin-${Date.now()}@test.local`;
    await signUp(email);
    const attempt = (password: string) =>
      auth.handler(
        new Request(`${origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ email, password }),
        }),
      );
    const wrong = await attempt("wrong-password");
    expect(wrong.status).toBe(401);
    expect(((await wrong.json()) as { code?: string }).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    const right = await attempt("correct-horse-1");
    expect(right.status).toBe(200);
    expect(right.headers.get("set-cookie")).toMatch(/session_token=/);
  });
});
