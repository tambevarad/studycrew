import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/teams/[teamId]/activity/route";
import type { ActivityTypeValue, EntityTypeValue } from "@/contracts/activity";
import { logActivity } from "@/server/activity";
import { db } from "@/server/db";
import { listActivity, listActivityFilterMembers } from "@/server/services/activity/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

async function event(teamId: string, actorId: string | null, at: string, type: ActivityTypeValue = "TASK_CREATED", entityType: EntityTypeValue = "task") {
  await db.activityEvent.create({
    data: { teamId, actorId, type, entityType, summary: `${type} at ${at}`, createdAt: new Date(at) },
  });
}

describe("PB-09 activity history", () => {
  it("AC1: lists the team's events newest first with the actor", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const other = await makeTeam();
    await event(team.id, leader.id, "2026-10-20T10:00:00Z");
    await event(team.id, members[0].id, "2026-10-21T10:00:00Z", "MEETING_CREATED", "meeting");
    await event(other.team.id, other.leader.id, "2026-10-22T10:00:00Z");

    const page = await listActivity(team.id, leader.id, { limit: 30 });
    expect(page.items.map((i) => i.type)).toEqual(["MEETING_CREATED", "TASK_CREATED"]);
    expect(page.items[0].actor?.id).toBe(members[0].id);
    expect(page.items[0].createdAt).toBe("2026-10-21T10:00:00.000Z");
    expect(page.nextCursor).toBeNull();
  });

  it("includes events written through logActivity()", async () => {
    const { team, leader } = await makeTeam();
    await logActivity({ teamId: team.id, actorId: leader.id, type: "TEAM_CREATED", entityType: "team", entityId: team.id, summary: "created the team" });
    const page = await listActivity(team.id, leader.id, { limit: 30 });
    expect(page.items[0]).toMatchObject({ type: "TEAM_CREATED", summary: "created the team", entityId: team.id });
  });

  it("AC2: filters by member, category, and type", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await event(team.id, leader.id, "2026-10-20T10:00:00Z", "TASK_CREATED", "task");
    await event(team.id, members[0].id, "2026-10-20T11:00:00Z", "TASK_MOVED", "task");
    await event(team.id, members[0].id, "2026-10-20T12:00:00Z", "MEETING_CREATED", "meeting");

    const byActor = await listActivity(team.id, leader.id, { limit: 30, actorId: members[0].id });
    expect(byActor.items).toHaveLength(2);
    const byEntity = await listActivity(team.id, leader.id, { limit: 30, entityType: "task" });
    expect(byEntity.items.map((i) => i.type)).toEqual(["TASK_MOVED", "TASK_CREATED"]);
    const both = await listActivity(team.id, leader.id, { limit: 30, actorId: members[0].id, entityType: "task" });
    expect(both.items.map((i) => i.type)).toEqual(["TASK_MOVED"]);
    const byType = await listActivity(team.id, leader.id, { limit: 30, type: "MEETING_CREATED" });
    expect(byType.items).toHaveLength(1);
  });

  it("AC3: pages with a cursor without duplicates or gaps, even with equal timestamps", async () => {
    const { team, leader } = await makeTeam();
    for (let i = 0; i < 35; i++) {
      // 5 events share each timestamp to exercise the id tie-breaker.
      await event(team.id, leader.id, new Date(Date.UTC(2026, 9, 1, Math.floor(i / 5))).toISOString());
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await listActivity(team.id, leader.id, { limit: 10, cursor });
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor);
    expect(pages).toBe(4);
    expect(seen).toHaveLength(35);
    expect(new Set(seen).size).toBe(35);
  });

  it("AC4: non-members are rejected (403) by the service and the route", async () => {
    const { team } = await makeTeam();
    const outsider = await makeUser();
    await expect(listActivity(team.id, outsider.id, { limit: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listActivityFilterMembers(team.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    signInAs(outsider);
    expect((await callRoute(GET, { params: { teamId: team.id } })).status).toBe(403);
  });

  it("AC5: events keep working after the actor's account is deleted", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await event(team.id, members[0].id, "2026-10-20T10:00:00Z");
    await db.user.delete({ where: { id: members[0].id } });
    const page = await listActivity(team.id, leader.id, { limit: 30 });
    expect(page.items[0].actor).toBeNull();
  });

  it("route returns the page envelope, honours filters, and validates the cursor", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    for (let i = 0; i < 3; i++) await event(team.id, leader.id, `2026-10-2${i}T10:00:00Z`);
    await event(team.id, members[0].id, "2026-10-25T10:00:00Z", "MEETING_RSVP", "meeting");
    signInAs(members[0]);

    const first = await callRoute(GET, { params: { teamId: team.id }, query: { limit: "2" } });
    expect(first.status).toBe(200);
    expect(first.json.data.items).toHaveLength(2);
    expect(first.json.data.nextCursor).toBeTruthy();

    const second = await callRoute(GET, { params: { teamId: team.id }, query: { limit: "2", cursor: first.json.data.nextCursor } });
    expect(second.json.data.items).toHaveLength(2);
    expect(second.json.data.nextCursor).toBeNull();

    const filtered = await callRoute(GET, { params: { teamId: team.id }, query: { entityType: "meeting" } });
    expect(filtered.json.data.items.map((i: { type: string }) => i.type)).toEqual(["MEETING_RSVP"]);

    expect((await callRoute(GET, { params: { teamId: team.id }, query: { cursor: "garbage" } })).status).toBe(400);
    expect((await callRoute(GET, { params: { teamId: team.id }, query: { entityType: "nope" } })).status).toBe(400);
  });

  it("lists filter members alphabetically", async () => {
    const { team, leader } = await makeTeam();
    const zed = await makeUser({ name: "Zed Zulu" });
    const amy = await makeUser({ name: "Amy Adams" });
    await db.teamMember.createMany({ data: [{ teamId: team.id, userId: zed.id }, { teamId: team.id, userId: amy.id }] });
    const names = (await listActivityFilterMembers(team.id, leader.id)).map((m) => m.name);
    expect(names[0]).toBe("Amy Adams");
    expect(names[names.length - 1]).toBe("Zed Zulu");
  });
});
