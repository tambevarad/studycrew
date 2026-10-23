import { describe, expect, it } from "vitest";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

let n = 0;
const email = () => `tz-${Date.now()}-${n++}@studycrew.test`;

async function signUp(timezone?: string) {
  return auth.api.signUpEmail({
    body: { name: "Time Zone", email: email(), password: "tz-test-pass-1", ...(timezone ? { timezone } : {}) },
    asResponse: true,
  });
}

describe("Better Auth timezone validation (contract fix)", () => {
  it("rejects sign-up with an invalid IANA time zone", async () => {
    const res = await signUp("Not/AZone");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: "Choose a valid time zone." });
  });

  it("accepts a valid time zone and keeps the default when none is sent", async () => {
    const ok = await signUp("Asia/Kolkata");
    expect(ok.status).toBe(200);
    const { user } = (await ok.json()) as { user: { id: string } };
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).timezone).toBe("Asia/Kolkata");

    const dflt = await signUp();
    const { user: u2 } = (await dflt.json()) as { user: { id: string } };
    expect((await db.user.findUniqueOrThrow({ where: { id: u2.id } })).timezone).toBe("America/Chicago");
  });

  it("rejects update-user with an invalid time zone and leaves the stored one unchanged", async () => {
    const res = await signUp("Europe/Berlin");
    const { user } = (await res.json()) as { user: { id: string } };
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const headers = new Headers({ cookie });

    await expect(auth.api.updateUser({ headers, body: { timezone: "Mars/Olympus" } })).rejects.toMatchObject({
      status: "BAD_REQUEST",
    });
    await auth.api.updateUser({ headers, body: { timezone: "America/New_York" } });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).timezone).toBe("America/New_York");
  });
});
