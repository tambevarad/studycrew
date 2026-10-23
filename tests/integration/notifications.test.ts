import { describe, expect, it, vi } from "vitest";
import { POST as READ } from "@/app/api/v1/me/notifications/read/route";
import { GET as LIST } from "@/app/api/v1/me/notifications/route";
import { GET as COUNT } from "@/app/api/v1/me/notifications/unread-count/route";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import {
  dueInPhrase,
  generateDueSoonNotifications,
  listNotifications,
  markRead,
  notificationTeamNames,
  unreadCount,
} from "@/server/services/notifications/service";
import { makeTask, makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const NOW = new Date("2026-10-28T15:00:00Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const dueSoon = (userId: string) => db.notification.findMany({ where: { userId, type: "TASK_DUE_SOON" } });

describe("PB-08 due-soon generator", () => {
  it("AC1: a task assigned to me due in 5 hours gives “X” is due in 5 h exactly once", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const me = members[0];
    const task = await makeTask(team.id, leader.id, { title: "Slides", dueAt: inHours(5), assigneeIds: [me.id] });
    expect(await generateDueSoonNotifications(me.id, NOW)).toBe(1);
    expect(await generateDueSoonNotifications(me.id, NOW)).toBe(0);
    await listNotifications(me.id, { limit: 30, unreadOnly: false }, NOW); // a "reload" runs the generator again
    const rows = await dueSoon(me.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "“Slides” is due in 5 h",
      teamId: team.id,
      link: `/teams/${team.id}/board?task=${task.id}`,
      dedupeKey: `due:${task.id}:${inHours(5).toISOString()}`,
    });
    expect(rows[0].body).toBe("Due Wed, Oct 28, 3:00 PM"); // 20:00 UTC in America/Chicago
  });

  it("AC2: Done, overdue, due in more than 24 h, or someone else's tasks give nothing", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const me = members[0];
    await makeTask(team.id, leader.id, { dueAt: inHours(3), status: "DONE", assigneeIds: [me.id] });
    await makeTask(team.id, leader.id, { dueAt: inHours(-1), assigneeIds: [me.id] });
    await makeTask(team.id, leader.id, { dueAt: inHours(25), assigneeIds: [me.id] });
    await makeTask(team.id, leader.id, { dueAt: inHours(2), assigneeIds: [leader.id] });
    await makeTask(team.id, leader.id, { dueAt: null, assigneeIds: [me.id] });
    expect(await generateDueSoonNotifications(me.id, NOW)).toBe(0);
    // The window is (now, now + 24 h]: exactly 24 h counts, exactly now does not.
    await makeTask(team.id, leader.id, { title: "Edge", dueAt: inHours(24), assigneeIds: [me.id] });
    await makeTask(team.id, leader.id, { dueAt: NOW, assigneeIds: [me.id] });
    expect(await generateDueSoonNotifications(me.id, NOW)).toBe(1);
    expect((await dueSoon(me.id))[0].title).toBe("“Edge” is due in 24 h");
  });

  it("re-dating a task produces a new reminder; tasks from teams I left are ignored", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const me = members[0];
    const task = await makeTask(team.id, leader.id, { dueAt: inHours(5), assigneeIds: [me.id] });
    await generateDueSoonNotifications(me.id, NOW);
    await db.task.update({ where: { id: task.id }, data: { dueAt: inHours(10) } });
    expect(await generateDueSoonNotifications(me.id, NOW)).toBe(1);
    expect(await dueSoon(me.id)).toHaveLength(2);

    await db.teamMember.delete({ where: { teamId_userId: { teamId: team.id, userId: me.id } } });
    await db.task.update({ where: { id: task.id }, data: { dueAt: inHours(12) } });
    expect(await generateDueSoonNotifications(me.id, NOW)).toBe(0);
  });

  it("phrases less than an hour without saying 0 h", () => {
    expect(dueInPhrase(new Date(NOW.getTime() + 20 * 60_000), NOW)).toBe("is due in under an hour");
  });
});

describe("PB-08 list, count, mark read", () => {
  async function seedNotifications(userId: string, count: number, teamId?: string) {
    for (let i = 0; i < count; i++) {
      await db.notification.create({
        data: {
          userId,
          teamId,
          type: "TASK_ASSIGNED",
          title: `N${i}`,
          createdAt: new Date(NOW.getTime() - (count - i) * 60_000),
        },
      });
    }
  }

  it("lists newest first with the envelope; unreadOnly filters", async () => {
    const me = await makeUser();
    await seedNotifications(me.id, 3);
    await markRead(me.id, { ids: [(await db.notification.findFirstOrThrow({ where: { title: "N2" } })).id] });
    signInAs(me);
    const all = await callRoute(LIST);
    expect(all.status).toBe(200);
    expect(all.json.data.items.map((n: { title: string }) => n.title)).toEqual(["N2", "N1", "N0"]);
    expect(all.json.data.items[0].readAt).not.toBeNull();
    const unread = await callRoute(LIST, { query: { unreadOnly: "true" } });
    expect(unread.json.data.items.map((n: { title: string }) => n.title)).toEqual(["N1", "N0"]);
    expect((await callRoute(LIST, { query: { unreadOnly: "maybe" } })).status).toBe(400);
  });

  it("AC6: pagination returns stable pages without duplicates, even with equal timestamps", async () => {
    const me = await makeUser();
    await seedNotifications(me.id, 5);
    const same = new Date(NOW.getTime() - 30_000);
    for (const title of ["S1", "S2", "S3"])
      await db.notification.create({ data: { userId: me.id, type: "POLL_CREATED", title, createdAt: same } });
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const res = await listNotifications(me.id, { limit: 3, unreadOnly: false, cursor }, NOW);
      seen.push(...res.items.map((n) => n.id));
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    expect(seen).toHaveLength(8);
    expect(new Set(seen).size).toBe(8);
    const expected = (
      await db.notification.findMany({ where: { userId: me.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
    ).map((n) => n.id);
    expect(seen).toEqual(expected);
  });

  it("rejects a cursor that isn't one of my notifications", async () => {
    const me = await makeUser();
    const other = await makeUser();
    await seedNotifications(other.id, 1);
    const theirs = await db.notification.findFirstOrThrow({ where: { userId: other.id } });
    signInAs(me);
    const res = await callRoute(LIST, { query: { cursor: theirs.id } });
    expect(res.status).toBe(400);
  });

  it("unread count includes freshly generated due-soon reminders", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const me = members[0];
    await seedNotifications(me.id, 2);
    await makeTask(team.id, leader.id, { dueAt: new Date(Date.now() + 2 * 3_600_000), assigneeIds: [me.id] });
    signInAs(me);
    const res = await callRoute(COUNT);
    expect(res.json).toEqual({ data: { count: 3 } });
    expect(await unreadCount(me.id)).toEqual({ count: 3 });
  });

  it("AC4: marking one read and then all read clears the count", async () => {
    const me = await makeUser();
    await seedNotifications(me.id, 3);
    signInAs(me);
    const first = await db.notification.findFirstOrThrow({ where: { userId: me.id } });
    expect((await callRoute(READ, { body: { ids: [first.id] } })).json).toEqual({ data: { updated: 1 } });
    expect((await callRoute(READ, { body: { ids: [first.id] } })).json).toEqual({ data: { updated: 0 } });
    expect((await callRoute(COUNT)).json.data.count).toBe(2);
    expect((await callRoute(READ, { body: { all: true } })).json).toEqual({ data: { updated: 2 } });
    expect((await callRoute(COUNT)).json.data.count).toBe(0);
    expect((await callRoute(READ, { body: {} })).status).toBe(400);
  });

  it("AC5: I can't read or mark another user's notifications", async () => {
    const me = await makeUser();
    const other = await makeUser();
    await seedNotifications(other.id, 2);
    const theirs = await db.notification.findMany({ where: { userId: other.id } });
    signInAs(me);
    expect((await callRoute(LIST)).json.data.items).toEqual([]);
    expect((await callRoute(READ, { body: { ids: theirs.map((n) => n.id) } })).json).toEqual({ data: { updated: 0 } });
    expect((await callRoute(READ, { body: { all: true } })).json).toEqual({ data: { updated: 0 } });
    expect(await db.notification.count({ where: { userId: other.id, readAt: null } })).toBe(2);
  });

  it("returns 401 when signed out", async () => {
    signOut();
    expect((await callRoute(LIST)).status).toBe(401);
    expect((await callRoute(COUNT)).status).toBe(401);
    expect((await callRoute(READ, { body: { all: true } })).status).toBe(401);
  });

  it("maps team ids to names for the page", async () => {
    const { team, leader } = await makeTeam({ name: "Alpha" });
    await notify({ userIds: [leader.id], type: "POLL_CREATED", teamId: team.id, title: "Vote" });
    await notify({ userIds: [leader.id], type: "TEAM_INVITE", title: "No team" });
    expect(await notificationTeamNames(leader.id)).toEqual({ [team.id]: "Alpha" });
  });
});
