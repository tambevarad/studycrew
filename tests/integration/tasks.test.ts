import { describe, expect, it, vi } from "vitest";
import { POST as MOVE } from "@/app/api/v1/teams/[teamId]/tasks/[taskId]/move/route";
import { DELETE, GET as GET_ONE, PATCH } from "@/app/api/v1/teams/[teamId]/tasks/[taskId]/route";
import { GET as LIST, POST as CREATE } from "@/app/api/v1/teams/[teamId]/tasks/route";
import { db } from "@/server/db";
import {
  createTask,
  listAssignableMembers,
  listMilestoneOptions,
  listTasks,
  moveTask,
  toTaskDTO,
  taskInclude,
  updateTask,
} from "@/server/services/tasks/service";
import { makeTask, makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const activity = (teamId: string, type: string) =>
  db.activityEvent.findMany({ where: { teamId, type: type as never } });
const notifications = (userId: string) => db.notification.findMany({ where: { userId, type: "TASK_ASSIGNED" } });

async function columnPositions(teamId: string, status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE") {
  const rows = await db.task.findMany({
    where: { teamId, status },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  return rows;
}

describe("PB-05 create and read", () => {
  it("AC1: creates at the bottom of To Do, logs activity, and notifies assignees but not me", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    await makeTask(team.id, leader.id, { position: 5000 });
    signInAs(leader);
    const dueAt = "2026-10-28T15:00:00.000Z";
    const res = await callRoute(CREATE, {
      params: { teamId: team.id },
      body: { title: "Slides", assigneeIds: [members[0].id, leader.id], dueAt, priority: "HIGH" },
    });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({
      title: "Slides",
      status: "TODO",
      priority: "HIGH",
      dueAt,
      position: 6000,
      completedAt: null,
    });
    expect(res.json.data.assignees.map((a: { id: string }) => a.id).sort()).toEqual([members[0].id, leader.id].sort());

    const created = await activity(team.id, "TASK_CREATED");
    expect(created.map((a) => a.summary)).toEqual(["created “Slides”"]);
    const [n] = await notifications(members[0].id);
    expect(n).toMatchObject({
      title: "You were assigned “Slides”",
      link: `/teams/${team.id}/board?task=${res.json.data.id}`,
    });
    expect(await notifications(leader.id)).toHaveLength(0);
    expect(await notifications(members[1].id)).toHaveLength(0);
  });

  it("first task in an empty column gets 1000; a task created as Done is completed", async () => {
    const { team, leader } = await makeTeam();
    const t = await createTask(team.id, leader.id, {
      title: "Done already",
      status: "DONE",
      priority: "LOW",
      assigneeIds: [],
    });
    expect(t.position).toBe(1000);
    expect(t.completedAt).not.toBeNull();
  });

  it("lists by column order then position, with filters", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await makeTask(team.id, leader.id, { title: "done", status: "DONE", position: 1 });
    await makeTask(team.id, leader.id, { title: "todo-2", status: "TODO", position: 2000 });
    await makeTask(team.id, leader.id, { title: "review", status: "REVIEW", position: 1000 });
    await makeTask(team.id, leader.id, {
      title: "todo-1",
      status: "TODO",
      position: 1000,
      assigneeIds: [members[0].id],
    });
    signInAs(members[0]);
    const all = await callRoute(LIST, { params: { teamId: team.id } });
    expect(all.json.data.map((t: { title: string }) => t.title)).toEqual(["todo-1", "todo-2", "review", "done"]);
    const mine = await callRoute(LIST, { params: { teamId: team.id }, query: { assigneeId: members[0].id } });
    expect(mine.json.data.map((t: { title: string }) => t.title)).toEqual(["todo-1"]);
    const review = await listTasks(team.id, leader.id, { status: "REVIEW" });
    expect(review.map((t) => t.title)).toEqual(["review"]);
    expect((await callRoute(LIST, { params: { teamId: team.id }, query: { status: "NOPE" } })).status).toBe(400);
  });

  it("toTaskDTO marks overdue only when not done", async () => {
    const { team, leader } = await makeTeam();
    const past = new Date("2026-10-20T12:00:00Z");
    const now = new Date("2026-10-22T12:00:00Z");
    const open = await makeTask(team.id, leader.id, { dueAt: past });
    const done = await makeTask(team.id, leader.id, { dueAt: past, status: "DONE" });
    const load = (id: string) => db.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    expect(toTaskDTO(await load(open.id), now).isOverdue).toBe(true);
    expect(toTaskDTO(await load(done.id), now).isOverdue).toBe(false);
  });

  it("GET one task; members and milestones for the pickers", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const task = await makeTask(team.id, leader.id, { title: "One" });
    await db.milestone.create({ data: { teamId: team.id, title: "Report" } });
    signInAs(members[0]);
    const res = await callRoute(GET_ONE, { params: { teamId: team.id, taskId: task.id } });
    expect(res.json.data).toMatchObject({ id: task.id, title: "One", coverageItemId: null });
    expect((await listAssignableMembers(team.id, leader.id)).map((m) => m.id).sort()).toEqual(
      [leader.id, members[0].id].sort(),
    );
    expect((await listMilestoneOptions(team.id, leader.id)).map((m) => m.title)).toEqual(["Report"]);
  });
});

describe("PB-05 validation and isolation", () => {
  it("AC5: assigning a non-member returns 400; a task id from another team returns 404", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    const outsider = await makeUser();
    const foreign = await makeTask(other.team.id, other.leader.id, { title: "Theirs" });
    signInAs(leader);

    const bad = await callRoute(CREATE, {
      params: { teamId: team.id },
      body: { title: "X", assigneeIds: [outsider.id] },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error.message).toBe("Everyone you assign must be a member of this team.");

    const p = { teamId: team.id, taskId: foreign.id };
    expect((await callRoute(GET_ONE, { params: p })).status).toBe(404);
    expect((await callRoute(PATCH, { method: "PATCH", params: p, body: { title: "Mine now" } })).status).toBe(404);
    expect((await callRoute(MOVE, { params: p, body: { status: "DONE", index: 0 } })).status).toBe(404);
    expect((await callRoute(DELETE, { method: "DELETE", params: p })).status).toBe(404);
    expect((await db.task.findUniqueOrThrow({ where: { id: foreign.id } })).title).toBe("Theirs");
  });

  it("rejects a milestone from another team and an empty title", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    const ms = await db.milestone.create({ data: { teamId: other.team.id, title: "Theirs" } });
    signInAs(leader);
    const res = await callRoute(CREATE, { params: { teamId: team.id }, body: { title: "X", milestoneId: ms.id } });
    expect(res.status).toBe(400);
    expect(res.json.error.details.fields.milestoneId).toBeTruthy();
    const empty = await callRoute(CREATE, { params: { teamId: team.id }, body: { title: "  " } });
    expect(empty.json.error.details.fields.title).toBe("Give the task a title.");
  });

  it("AC9: non-members get 403 on every task route", async () => {
    const { team, leader } = await makeTeam();
    const task = await makeTask(team.id, leader.id);
    signInAs(await makeUser());
    const p = { teamId: team.id, taskId: task.id };
    expect((await callRoute(LIST, { params: { teamId: team.id } })).status).toBe(403);
    expect((await callRoute(CREATE, { params: { teamId: team.id }, body: { title: "x" } })).status).toBe(403);
    expect((await callRoute(GET_ONE, { params: p })).status).toBe(403);
    expect((await callRoute(PATCH, { method: "PATCH", params: p, body: { title: "x" } })).status).toBe(403);
    expect((await callRoute(MOVE, { params: p, body: { status: "DONE", index: 0 } })).status).toBe(403);
    expect((await callRoute(DELETE, { method: "DELETE", params: p })).status).toBe(403);
    await expect(listTasks(team.id, (await makeUser()).id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("PB-05 update and delete", () => {
  it("AC6: editing assignees notifies only newly added people", async () => {
    const { team, leader, members } = await makeTeam({ members: 3 });
    const [a, b, c] = members;
    signInAs(leader);
    const created = await callRoute(CREATE, {
      params: { teamId: team.id },
      body: { title: "Report", assigneeIds: [a.id] },
    });
    const taskId = created.json.data.id;
    const res = await callRoute(PATCH, {
      method: "PATCH",
      params: { teamId: team.id, taskId },
      body: { assigneeIds: [a.id, b.id, leader.id] },
    });
    expect(res.status).toBe(200);
    expect(res.json.data.assignees.map((u: { id: string }) => u.id).sort()).toEqual([a.id, b.id, leader.id].sort());
    expect(await notifications(a.id)).toHaveLength(1); // from creation only
    expect(await notifications(b.id)).toHaveLength(1);
    expect(await notifications(c.id)).toHaveLength(0);
    expect(await notifications(leader.id)).toHaveLength(0);
    const assigned = await activity(team.id, "TASK_ASSIGNED");
    expect(assigned).toHaveLength(1);
    expect(assigned[0].summary).toContain("to “Report”");
    expect(assigned[0].metadata).toMatchObject({ userIds: expect.arrayContaining([b.id, leader.id]) });
    expect(await activity(team.id, "TASK_UPDATED")).toHaveLength(0);

    // Removing someone is an update, not an assignment.
    await updateTask(team.id, leader.id, taskId, { assigneeIds: [b.id] });
    const updated = await activity(team.id, "TASK_UPDATED");
    const removedNames = [a.name, leader.name].sort().join(" and ");
    expect(updated.map((u) => u.summary)).toEqual([`unassigned ${removedNames} from “Report”`]);
    expect(await notifications(a.id)).toHaveLength(1);
  });

  it("logs TASK_UPDATED naming what changed, and nothing when nothing changed", async () => {
    const { team, leader } = await makeTeam();
    const t = await createTask(team.id, leader.id, {
      title: "Draft",
      status: "TODO",
      priority: "MEDIUM",
      assigneeIds: [],
    });
    await updateTask(team.id, leader.id, t.id, { dueAt: "2026-10-30T17:00:00.000Z" });
    await updateTask(team.id, leader.id, t.id, { title: "Final draft" });
    await updateTask(team.id, leader.id, t.id, { priority: "HIGH", description: "Read it twice" });
    await updateTask(team.id, leader.id, t.id, { priority: "HIGH", title: "Final draft" });
    const summaries = (await activity(team.id, "TASK_UPDATED")).map((a) => a.summary);
    expect(summaries).toEqual([
      "changed the due date of “Draft”",
      "renamed “Draft” to “Final draft”",
      "changed the description and priority of “Final draft”",
    ]);
    const final = await updateTask(team.id, leader.id, t.id, { dueAt: null, description: null });
    expect(final).toMatchObject({ dueAt: null, description: null, priority: "HIGH" });
  });

  it("deletes a task and logs TASK_DELETED", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const task = await makeTask(team.id, leader.id, { title: "Old" });
    signInAs(members[0]);
    const res = await callRoute(DELETE, { method: "DELETE", params: { teamId: team.id, taskId: task.id } });
    expect(res.json).toEqual({ data: { deleted: true } });
    expect(await db.task.count({ where: { id: task.id } })).toBe(0);
    expect((await activity(team.id, "TASK_DELETED")).map((a) => a.summary)).toEqual(["deleted “Old”"]);
  });
});

describe("PB-05 move", () => {
  it("AC2: moving to Done completes the task; moving it back clears completedAt", async () => {
    const { team, leader } = await makeTeam();
    const task = await makeTask(team.id, leader.id, { title: "Slides", status: "REVIEW" });
    signInAs(leader);
    const p = { teamId: team.id, taskId: task.id };
    const done = await callRoute(MOVE, { params: p, body: { status: "DONE", index: 0 } });
    expect(done.status).toBe(200);
    expect(done.json.data.status).toBe("DONE");
    expect(done.json.data.completedAt).not.toBeNull();
    expect((await activity(team.id, "TASK_COMPLETED")).map((a) => a.summary)).toEqual(["completed “Slides”"]);

    const back = await callRoute(MOVE, { params: p, body: { status: "IN_PROGRESS", index: 0 } });
    expect(back.json.data).toMatchObject({ status: "IN_PROGRESS", completedAt: null });
    expect((await activity(team.id, "TASK_MOVED")).map((a) => a.summary)).toEqual(["moved “Slides” to In Progress"]);
  });

  it("AC3: reordering within a column persists and logs nothing", async () => {
    const { team, leader } = await makeTeam();
    await makeTask(team.id, leader.id, { title: "A", position: 1000 });
    await makeTask(team.id, leader.id, { title: "B", position: 2000 });
    const c = await makeTask(team.id, leader.id, { title: "C", position: 3000 });
    await moveTask(team.id, leader.id, c.id, { status: "TODO", index: 0 });
    // A fresh read (like a page reload) sees the new order.
    const order = (await listTasks(team.id, leader.id, { status: "TODO" })).map((t) => t.title);
    expect(order).toEqual(["C", "A", "B"]);
    await moveTask(team.id, leader.id, c.id, { status: "TODO", index: 1 });
    expect((await listTasks(team.id, leader.id, { status: "TODO" })).map((t) => t.title)).toEqual(["A", "C", "B"]);
    expect(await db.activityEvent.count({ where: { teamId: team.id } })).toBe(0);
  });

  it("AC4: index 0, middle, and end give strictly increasing positions", async () => {
    const { team, leader } = await makeTeam();
    for (const [i, title] of ["A", "B", "C"].entries())
      await makeTask(team.id, leader.id, { title, status: "REVIEW", position: (i + 1) * 1000 });
    const x = await makeTask(team.id, leader.id, { title: "X", status: "TODO" });
    const y = await makeTask(team.id, leader.id, { title: "Y", status: "TODO" });
    const z = await makeTask(team.id, leader.id, { title: "Z", status: "TODO" });
    await moveTask(team.id, leader.id, x.id, { status: "REVIEW", index: 0 });
    await moveTask(team.id, leader.id, y.id, { status: "REVIEW", index: 2 });
    await moveTask(team.id, leader.id, z.id, { status: "REVIEW", index: 99 });
    const rows = await db.task.findMany({ where: { teamId: team.id, status: "REVIEW" }, orderBy: { position: "asc" } });
    expect(rows.map((r) => r.title)).toEqual(["X", "A", "Y", "B", "C", "Z"]);
    const ps = rows.map((r) => r.position);
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThan(ps[i - 1]);
  });

  it("AC4: a tight gap renumbers the column in the same move", async () => {
    const { team, leader } = await makeTeam();
    await makeTask(team.id, leader.id, { title: "A", position: 1000 });
    await makeTask(team.id, leader.id, { title: "B", position: 1000.0004 });
    const m = await makeTask(team.id, leader.id, { title: "M", status: "REVIEW" });
    await moveTask(team.id, leader.id, m.id, { status: "TODO", index: 1 });
    const rows = await columnPositions(team.id, "TODO");
    expect(rows.map((r) => r.position)).toEqual([1000, 2000, 3000]);
    const titles = await db.task.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, title: true },
    });
    const byId = new Map(titles.map((t) => [t.id, t.title]));
    expect(rows.map((r) => byId.get(r.id))).toEqual(["A", "M", "B"]);
  });

  it("validates the move body", async () => {
    const { team, leader } = await makeTeam();
    const task = await makeTask(team.id, leader.id);
    signInAs(leader);
    const res = await callRoute(MOVE, {
      params: { teamId: team.id, taskId: task.id },
      body: { status: "LATER", index: -1 },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.json.error.details.fields).sort()).toEqual(["index", "status"]);
  });
});
