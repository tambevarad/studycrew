import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { logActivity } from "@/server/activity";
import { db } from "@/server/db";
import { created, parseBody, parseQuery, teamRoute, authedRoute } from "@/server/http";
import { notify } from "@/server/notifications";
import { assertAllMembers, getTeamMemberIds, isMember, requireLeader, requireMembership } from "@/server/permissions";
import { getTeamAvailability } from "@/server/shared/team-availability";
import { getTeamHeader, listMyTeams } from "@/server/shared/teams";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

describe("permissions", () => {
  it("allows members and rejects outsiders with 403, missing teams with 404", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const outsider = await makeUser();
    await expect(requireMembership(team.id, leader.id)).resolves.toMatchObject({ role: "LEADER" });
    await expect(requireMembership(team.id, members[0].id)).resolves.toMatchObject({ role: "MEMBER" });
    await expect(requireMembership(team.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireMembership("nope", outsider.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await isMember(team.id, outsider.id)).toBe(false);
  });

  it("requires leader role for leader actions", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await expect(requireLeader(team.id, leader.id)).resolves.toBeTruthy();
    await expect(requireLeader(team.id, members[0].id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates assignees are members", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const outsider = await makeUser();
    await expect(assertAllMembers(team.id, [leader.id, members[0].id, leader.id])).resolves.toBeUndefined();
    await expect(assertAllMembers(team.id, [outsider.id])).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await getTeamMemberIds(team.id)).sort()).toEqual([leader.id, members[0].id].sort());
  });
});

describe("logActivity", () => {
  it("appends an event", async () => {
    const { team, leader } = await makeTeam();
    await logActivity({ teamId: team.id, actorId: leader.id, type: "TASK_CREATED", entityType: "task", entityId: "t1", summary: "created “X”", metadata: { a: 1 } });
    const events = await db.activityEvent.findMany({ where: { teamId: team.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "TASK_CREATED", summary: "created “X”", metadata: { a: 1 } });
  });
});

describe("notify", () => {
  it("skips the actor, removes duplicates, and respects dedupe keys", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    const ids = [leader.id, members[0].id, members[1].id, members[0].id];
    expect(await notify({ userIds: ids, exceptUserId: leader.id, type: "TASK_ASSIGNED", teamId: team.id, title: "Hi" })).toBe(2);
    expect(await notify({ userIds: [members[0].id], type: "TASK_DUE_SOON", title: "Due", dedupeKey: "due:t1" })).toBe(1);
    expect(await notify({ userIds: [members[0].id], type: "TASK_DUE_SOON", title: "Due", dedupeKey: "due:t1" })).toBe(0);
    expect(await notify({ userIds: [leader.id], exceptUserId: leader.id, type: "TASK_ASSIGNED", title: "x" })).toBe(0);
    expect(await db.notification.count({ where: { userId: members[0].id } })).toBe(2);
  });
});

describe("route helpers", () => {
  const schema = z.object({ title: z.string().min(1) });
  const POST = teamRoute(async ({ req, params }) => created({ ...(await parseBody(req, schema)), teamId: params.teamId }));
  const LEADER_ONLY = teamRoute(async () => ({ ok: true }), { leaderOnly: true });
  const ME = authedRoute(async ({ req, user }) => ({ id: user.id, q: parseQuery(req, z.object({ x: z.string() })).x }));

  it("enforces auth, membership, validation, and the response envelope", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const outsider = await makeUser();

    signOut();
    expect((await callRoute(POST, { params: { teamId: team.id }, body: { title: "a" } })).status).toBe(401);

    signInAs(outsider);
    expect((await callRoute(POST, { params: { teamId: team.id }, body: { title: "a" } })).status).toBe(403);
    expect((await callRoute(POST, { params: { teamId: "missing" }, body: { title: "a" } })).status).toBe(404);

    signInAs(members[0]);
    const bad = await callRoute(POST, { params: { teamId: team.id }, body: { title: "" } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("VALIDATION");
    expect(bad.json.error.details.fields.title).toBeTruthy();

    const ok = await callRoute(POST, { params: { teamId: team.id }, body: { title: "a" } });
    expect(ok.status).toBe(201);
    expect(ok.json).toEqual({ data: { title: "a", teamId: team.id } });

    expect((await callRoute(LEADER_ONLY, { params: { teamId: team.id } })).status).toBe(403);
    signInAs(leader);
    expect((await callRoute(LEADER_ONLY, { params: { teamId: team.id } })).json).toEqual({ data: { ok: true } });

    const me = await callRoute(ME, { query: { x: "y" } });
    expect(me.json).toEqual({ data: { id: leader.id, q: "y" } });
    expect((await callRoute(ME)).status).toBe(400);
  });
});

describe("shared readers", () => {
  it("lists my teams and team availability", async () => {
    const { team, leader, members } = await makeTeam({ members: 1, name: "Alpha" });
    await db.availability.create({ data: { userId: members[0].id, slots: [50, 3, 3] } });
    const mine = await listMyTeams(leader.id);
    expect(mine).toEqual([{ id: team.id, name: "Alpha", courseCode: "CSE 6324", role: "LEADER", memberCount: 2 }]);
    const avail = await getTeamAvailability(team.id);
    expect(avail.members).toHaveLength(2);
    expect(avail.members.find((m) => m.user.id === members[0].id)?.slots).toEqual([3, 3, 50]);
    expect(avail.members.find((m) => m.user.id === leader.id)?.slots).toEqual([]);
    expect((await getTeamHeader(team.id))?.name).toBe("Alpha");
  });
});
