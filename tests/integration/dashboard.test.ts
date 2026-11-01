import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/teams/[teamId]/dashboard/route";
import { db } from "@/server/db";
import { getTeamDashboard, listMyOpenTasks, listMyUpcomingMeetings } from "@/server/services/dashboard/service";
import { makeMeeting, makeTask, makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const NOW = new Date("2026-11-04T15:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("PB-12 getTeamDashboard", () => {
  it("AC1: with 7 tasks of which 2 are Done, completion is 29%", async () => {
    const { team, leader } = await makeTeam();
    for (let i = 0; i < 5; i++) await makeTask(team.id, leader.id, { status: i % 2 ? "TODO" : "IN_PROGRESS" });
    await makeTask(team.id, leader.id, { status: "DONE" });
    await makeTask(team.id, leader.id, { status: "DONE" });
    const d = await getTeamDashboard(team.id, leader.id, NOW);
    expect(d).toMatchObject({ teamId: team.id, totalTasks: 7, doneTasks: 2, completionPercent: 29 });
  });

  it("an empty team is all zeros, with no division by zero", async () => {
    const { team, leader } = await makeTeam({ members: 1 });
    const d = await getTeamDashboard(team.id, leader.id, NOW);
    expect(d).toMatchObject({ totalTasks: 0, doneTasks: 0, completionPercent: 0, overdueTasks: [], dueSoonTasks: [] });
    expect(d.openTasksPerMember.every((r) => r.open === 0 && r.overdue === 0)).toBe(true);
  });

  it("AC2: overdue = due before now and not Done, oldest first; due soon = the next 24 h", async () => {
    const { team, leader } = await makeTeam();
    await makeTask(team.id, leader.id, { title: "late 1 h", dueAt: hours(-1) });
    await makeTask(team.id, leader.id, { title: "late 3 d", dueAt: hours(-72) });
    await makeTask(team.id, leader.id, { title: "late but done", dueAt: hours(-5), status: "DONE" });
    await makeTask(team.id, leader.id, { title: "in 5 h", dueAt: hours(5) });
    await makeTask(team.id, leader.id, { title: "in exactly 24 h", dueAt: hours(24) });
    await makeTask(team.id, leader.id, { title: "in 25 h", dueAt: hours(25) });
    await makeTask(team.id, leader.id, { title: "soon but done", dueAt: hours(2), status: "DONE" });
    await makeTask(team.id, leader.id, { title: "no due date" });

    const d = await getTeamDashboard(team.id, leader.id, NOW);
    expect(d.overdueTasks.map((t) => t.title)).toEqual(["late 3 d", "late 1 h"]);
    expect(d.overdueTasks.every((t) => t.isOverdue && t.teamId === team.id)).toBe(true);
    expect(d.dueSoonTasks.map((t) => t.title)).toEqual(["in 5 h", "in exactly 24 h"]);
  });

  it("AC3: workload lists every member with open and overdue counts, including members with 0", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    const [ana, ben] = members;
    await db.user.update({ where: { id: ana.id }, data: { name: "Ana" } });
    await db.user.update({ where: { id: ben.id }, data: { name: "Ben" } });
    await db.user.update({ where: { id: leader.id }, data: { name: "Lee" } });
    await makeTask(team.id, leader.id, { assigneeIds: [ana.id], dueAt: hours(-2) }); // open + overdue
    await makeTask(team.id, leader.id, { assigneeIds: [ana.id, leader.id] }); // open for both
    await makeTask(team.id, leader.id, { assigneeIds: [ana.id], status: "DONE", dueAt: hours(-2) }); // not counted
    await makeTask(team.id, leader.id, { assigneeIds: [] }); // nobody's

    const d = await getTeamDashboard(team.id, leader.id, NOW);
    expect(d.openTasksPerMember.map((r) => [r.user.name, r.open, r.overdue])).toEqual([
      ["Ana", 2, 1],
      ["Ben", 0, 0],
      ["Lee", 1, 0],
    ]);
  });

  it("shows the next 5 meetings of this team that haven't ended, soonest first", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    await makeMeeting(team.id, leader.id, hours(-3), 60); // ended
    await makeMeeting(team.id, leader.id, hours(-0.5), 60); // in progress
    for (const h of [48, 2, 200, 24, 72, 5]) await makeMeeting(team.id, leader.id, hours(h), 60);
    await makeMeeting(other.team.id, other.leader.id, hours(1), 60);

    const d = await getTeamDashboard(team.id, leader.id, NOW);
    expect(d.upcomingMeetings.map((m) => m.startsAt)).toEqual([-0.5, 2, 5, 24, 48].map((h) => hours(h).toISOString()));
    expect(d.upcomingMeetings.every((m) => m.teamId === team.id)).toBe(true);
  });

  it("includes milestone progress from linked tasks", async () => {
    const { team, leader } = await makeTeam();
    const ms = await db.milestone.create({ data: { teamId: team.id, title: "Report" } });
    const done = await makeTask(team.id, leader.id, { status: "DONE" });
    const open = await makeTask(team.id, leader.id);
    await db.task.updateMany({ where: { id: { in: [done.id, open.id] } }, data: { milestoneId: ms.id } });
    const d = await getTeamDashboard(team.id, leader.id, NOW);
    expect(d.milestones).toEqual([
      expect.objectContaining({ title: "Report", taskCount: 2, doneCount: 1, percent: 50 }),
    ]);
  });

  it("only members can see it", async () => {
    const { team } = await makeTeam();
    const outsider = await makeUser();
    await expect(getTeamDashboard(team.id, outsider.id, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("PB-12 GET /api/v1/teams/:teamId/dashboard", () => {
  it("returns the dashboard to members, 403 to non-members, 401 when signed out", async () => {
    const { team, leader } = await makeTeam({ members: 1 });
    await makeTask(team.id, leader.id, { status: "DONE" });
    signInAs(leader);
    const ok = await callRoute(GET, { params: { teamId: team.id } });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ teamId: team.id, totalTasks: 1, doneTasks: 1, completionPercent: 100 });
    expect(ok.json.data.openTasksPerMember).toHaveLength(2);

    signInAs(await makeUser());
    expect((await callRoute(GET, { params: { teamId: team.id } })).status).toBe(403);
    signOut();
    expect((await callRoute(GET, { params: { teamId: team.id } })).status).toBe(401);
  });
});

describe("PB-12 personal home", () => {
  it("AC5: lists only my assigned, not-Done tasks across my teams, soonest due first", async () => {
    const a = await makeTeam({ members: 1, name: "Alpha" });
    const b = await makeTeam({ name: "Beta" });
    const me = a.members[0];
    await db.teamMember.create({ data: { teamId: b.team.id, userId: me.id } });
    const left = await makeTeam({ name: "Left" });
    await db.teamMember.create({ data: { teamId: left.team.id, userId: me.id } });

    await makeTask(a.team.id, a.leader.id, { title: "A later", assigneeIds: [me.id], dueAt: hours(48) });
    await makeTask(b.team.id, b.leader.id, { title: "B overdue", assigneeIds: [me.id], dueAt: hours(-4) });
    await makeTask(a.team.id, a.leader.id, { title: "A no date", assigneeIds: [me.id] });
    await makeTask(b.team.id, b.leader.id, { title: "B soon", assigneeIds: [me.id, b.leader.id], dueAt: hours(3) });
    await makeTask(a.team.id, a.leader.id, { title: "A done", assigneeIds: [me.id], status: "DONE", dueAt: hours(1) });
    await makeTask(a.team.id, a.leader.id, { title: "A not mine", assigneeIds: [a.leader.id], dueAt: hours(1) });
    await makeTask(left.team.id, left.leader.id, {
      title: "from a team I left",
      assigneeIds: [me.id],
      dueAt: hours(1),
    });
    await db.teamMember.delete({ where: { teamId_userId: { teamId: left.team.id, userId: me.id } } });

    const mine = await listMyOpenTasks(me.id, NOW);
    expect(mine.map((t) => t.title)).toEqual(["B overdue", "B soon", "A later", "A no date"]);
    expect(mine[0]).toMatchObject({ teamId: b.team.id, isOverdue: true });
    expect(mine.every((t) => t.assignees.some((u) => u.id === me.id) && t.status !== "DONE")).toBe(true);
  });

  it("lists my next meetings across my teams, not yet ended, up to the limit", async () => {
    const a = await makeTeam({ members: 1 });
    const b = await makeTeam();
    const me = a.members[0];
    await db.teamMember.create({ data: { teamId: b.team.id, userId: me.id } });
    const stranger = await makeTeam();
    await makeMeeting(a.team.id, a.leader.id, hours(-5), 60); // ended
    await makeMeeting(a.team.id, a.leader.id, hours(30), 60);
    await makeMeeting(b.team.id, b.leader.id, hours(6), 60);
    await makeMeeting(stranger.team.id, stranger.leader.id, hours(1), 60); // not my team

    const next = await listMyUpcomingMeetings(me.id, NOW);
    expect(next.map((m) => [m.teamId, m.startsAt])).toEqual([
      [b.team.id, hours(6).toISOString()],
      [a.team.id, hours(30).toISOString()],
    ]);
    expect(await listMyUpcomingMeetings(me.id, NOW, 1)).toHaveLength(1);
  });
});
