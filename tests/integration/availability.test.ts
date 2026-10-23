import { describe, expect, it, vi } from "vitest";
import { GET as MY_GET, PUT as MY_PUT } from "@/app/api/v1/me/availability/route";
import { GET as TEAM_GET } from "@/app/api/v1/teams/[teamId]/availability/route";
import { slotOf } from "@/contracts/availability";
import { db } from "@/server/db";
import { getMyAvailability, getTeamAvailabilityFor, setMyAvailability } from "@/server/services/availability/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const put = (slots: unknown) => callRoute(MY_PUT, { method: "PUT", body: { slots } });

describe("PB-03 my availability", () => {
  it("returns empty slots and updatedAt null before the first save", async () => {
    const user = await makeUser({ timezone: "Asia/Kolkata" });
    expect(await getMyAvailability(user.id)).toEqual({
      userId: user.id,
      timezone: "Asia/Kolkata",
      slots: [],
      updatedAt: null,
    });
    await expect(getMyAvailability("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setMyAvailability("missing", { slots: [] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("AC1: Mon 18:00 to Wed 21:30 (24 slots) is stored and returned by GET", async () => {
    const user = await makeUser();
    signInAs(user);
    const slots: number[] = [];
    for (let day = 0; day <= 2; day++) for (let hh = 36; hh <= 43; hh++) slots.push(slotOf(day, hh));
    const res = await put(slots);
    expect(res.status).toBe(200);
    expect(res.json.data.slots).toHaveLength(24);
    expect(res.json.data.updatedAt).not.toBeNull();
    const get = await callRoute(MY_GET);
    expect(get.json.data).toMatchObject({ userId: user.id, timezone: "America/Chicago", slots });
  });

  it("AC4: saving twice is idempotent; duplicates are removed and the result is sorted", async () => {
    const user = await makeUser();
    signInAs(user);
    const first = await put([50, 3, 3, 200, 50]);
    expect(first.json.data.slots).toEqual([3, 50, 200]);
    const second = await put([200, 50, 3]);
    expect(second.json.data.slots).toEqual([3, 50, 200]);
    expect(await db.availability.count({ where: { userId: user.id } })).toBe(1);
    expect((await put([])).json.data.slots).toEqual([]);
  });

  it("AC5: slots outside 0–335 or more than 336 entries → 400", async () => {
    const user = await makeUser();
    signInAs(user);
    expect((await put([336])).status).toBe(400);
    expect((await put([-1])).status).toBe(400);
    expect((await put([1.5])).status).toBe(400);
    const tooMany = await put(Array.from({ length: 337 }, (_, i) => i % 336));
    expect(tooMany.status).toBe(400);
    expect(tooMany.json.error.details.fields.slots).toBeTruthy();
    expect((await put(Array.from({ length: 336 }, (_, i) => i))).status).toBe(200);
  });

  it("returns 401 when signed out", async () => {
    signOut();
    expect((await callRoute(MY_GET)).status).toBe(401);
    expect((await put([1])).status).toBe(401);
  });
});

describe("PB-03 team availability", () => {
  it("AC6: returns every member with their time zone and slots; non-members get 403", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await db.user.update({ where: { id: members[0].id }, data: { timezone: "America/New_York" } });
    await setMyAvailability(members[0].id, { slots: [100, 10] });
    signInAs(leader);
    const res = await callRoute(TEAM_GET, { params: { teamId: team.id } });
    expect(res.status).toBe(200);
    expect(res.json.data.teamId).toBe(team.id);
    const byId = new Map(res.json.data.members.map((m: { user: { id: string } }) => [m.user.id, m]));
    expect(byId.get(members[0].id)).toMatchObject({ timezone: "America/New_York", slots: [10, 100] });
    expect(byId.get(leader.id)).toMatchObject({ timezone: "America/Chicago", slots: [] });
    // Team members' summaries don't include anyone's bio.
    expect(JSON.stringify(res.json.data)).not.toContain("bio");

    signInAs(await makeUser());
    expect((await callRoute(TEAM_GET, { params: { teamId: team.id } })).status).toBe(403);
    await expect(getTeamAvailabilityFor(team.id, (await makeUser()).id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
