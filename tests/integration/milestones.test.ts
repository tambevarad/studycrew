import { describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/v1/teams/[teamId]/milestones/[milestoneId]/route";
import { POST as LINK } from "@/app/api/v1/teams/[teamId]/milestones/[milestoneId]/tasks/route";
import { POST as APPLY } from "@/app/api/v1/teams/[teamId]/milestones/apply-template/route";
import { GET as LIST, POST as CREATE } from "@/app/api/v1/teams/[teamId]/milestones/route";
import { MILESTONE_TEMPLATES } from "@/contracts/milestones";
import { db } from "@/server/db";
import {
  applyTemplate,
  createMilestone,
  deleteMilestone,
  linkTask,
  listMilestones,
  PAST_FINAL_DATE_MESSAGE,
  updateMilestone,
} from "@/server/services/milestones/service";
import { makeTask, makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const NOW = new Date("2026-11-02T16:00:00Z"); // Mon Nov 2, 10:00 am CST
const FINAL = "2026-11-21T05:59:00.000Z"; // Fri Nov 20, 11:59 pm CST
const events = (teamId: string, type: string) => db.activityEvent.findMany({ where: { teamId, type: type as never } });

describe("PB-13 applyTemplate", () => {
  it("AC1: the Presentation template makes 5 milestones with increasing due dates ending on the final date", async () => {
    const { team, leader } = await makeTeam();

    const made = await applyTemplate(team.id, leader.id, { templateKey: "presentation", finalDueAt: FINAL }, NOW);

    expect(made.map((m) => m.title)).toEqual([...MILESTONE_TEMPLATES.presentation.milestones]);
    const due = made.map((m) => new Date(m.dueAt!).getTime());
    for (let i = 1; i < due.length; i++) expect(due[i]).toBeGreaterThan(due[i - 1]);
    expect(made.at(-1)?.dueAt).toBe(FINAL);
    expect(due[0]).toBeGreaterThan(NOW.getTime());
    expect(made.every((m) => m.templateKey === "presentation" && m.percent === 0 && m.taskCount === 0)).toBe(true);
    expect(await events(team.id, "MILESTONE_CREATED")).toHaveLength(5);
  });

  it("adds the template after existing milestones, in order", async () => {
    const { team, leader } = await makeTeam();
    await createMilestone(team.id, leader.id, { title: "Kick-off" });

    await applyTemplate(team.id, leader.id, { templateKey: "exam-prep", finalDueAt: FINAL }, NOW);

    const list = await listMilestones(team.id, leader.id);
    expect(list.map((m) => m.title)).toEqual(["Kick-off", ...MILESTONE_TEMPLATES["exam-prep"].milestones]);
    expect(list.map((m) => m.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("a final date in the past is a 400 with a clear message, and nothing is created", async () => {
    const { team, leader } = await makeTeam();

    await expect(
      applyTemplate(team.id, leader.id, { templateKey: "report", finalDueAt: "2026-11-01T05:59:00.000Z" }, NOW),
    ).rejects.toMatchObject({ code: "VALIDATION", message: PAST_FINAL_DATE_MESSAGE });
    expect(await db.milestone.count({ where: { teamId: team.id } })).toBe(0);
  });
});

describe("PB-13 progress and links", () => {
  it("AC2: linking 4 tasks of which 1 is Done shows 25%", async () => {
    const { team, leader } = await makeTeam();
    const m = await createMilestone(team.id, leader.id, { title: "Draft slides" });
    const tasks = [
      await makeTask(team.id, leader.id, { status: "DONE" }),
      await makeTask(team.id, leader.id),
      await makeTask(team.id, leader.id, { status: "IN_PROGRESS" }),
      await makeTask(team.id, leader.id, { status: "REVIEW" }),
    ];

    let dto = m;
    for (const t of tasks) dto = await linkTask(team.id, leader.id, m.id, t.id);

    expect(dto).toMatchObject({ taskCount: 4, doneCount: 1, percent: 25 });
    expect((await listMilestones(team.id, leader.id))[0].percent).toBe(25);
    expect(await events(team.id, "TASK_UPDATED")).toHaveLength(4); // written by PB-05 updateTask
  });

  it("a task can move to another milestone; a task or milestone from another team is a 404", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    const a = await createMilestone(team.id, leader.id, { title: "A" });
    const b = await createMilestone(team.id, leader.id, { title: "B" });
    const task = await makeTask(team.id, leader.id);
    const foreignTask = await makeTask(other.team.id, other.leader.id);
    const foreignMilestone = await createMilestone(other.team.id, other.leader.id, { title: "Theirs" });

    await linkTask(team.id, leader.id, a.id, task.id);
    expect(await linkTask(team.id, leader.id, b.id, task.id)).toMatchObject({ taskCount: 1 });
    expect((await listMilestones(team.id, leader.id)).find((m) => m.id === a.id)?.taskCount).toBe(0);

    await expect(linkTask(team.id, leader.id, a.id, foreignTask.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(linkTask(team.id, leader.id, foreignMilestone.id, task.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("AC3: deleting a milestone keeps its tasks, unlinked", async () => {
    const { team, leader } = await makeTeam();
    const m = await createMilestone(team.id, leader.id, { title: "Rehearsal" });
    const task = await makeTask(team.id, leader.id);
    await linkTask(team.id, leader.id, m.id, task.id);

    expect(await deleteMilestone(team.id, leader.id, m.id)).toEqual({ deleted: true });

    expect(await db.milestone.count({ where: { teamId: team.id } })).toBe(0);
    expect(await db.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ milestoneId: null });
    expect((await events(team.id, "MILESTONE_DELETED"))[0].summary).toBe("deleted the milestone “Rehearsal”");
  });
});

describe("PB-13 create, update, permissions", () => {
  it("creates with optional fields, renames with a clear activity line, clears a due date", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const m = await createMilestone(team.id, members[0].id, { title: "Outline", description: "", dueAt: FINAL });
    expect(m).toMatchObject({ title: "Outline", description: null, dueAt: FINAL, position: 1, templateKey: null });

    const renamed = await updateMilestone(team.id, leader.id, m.id, { title: "Outline agreed", dueAt: null });
    expect(renamed).toMatchObject({ title: "Outline agreed", dueAt: null });
    const updates = await events(team.id, "MILESTONE_UPDATED");
    expect(updates[0].summary).toBe("renamed the milestone “Outline” to “Outline agreed”");

    await updateMilestone(team.id, leader.id, m.id, { description: "Agree on sections" });
    expect((await events(team.id, "MILESTONE_UPDATED")).map((e) => e.summary)).toContain(
      "updated the milestone “Outline agreed”",
    );
  });

  it("non-members get 403; a milestone from another team is a 404", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    const m = await createMilestone(team.id, leader.id, { title: "Mine" });
    const outsider = await makeUser();

    await expect(listMilestones(team.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createMilestone(team.id, outsider.id, { title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateMilestone(other.team.id, other.leader.id, m.id, { title: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteMilestone(other.team.id, other.leader.id, m.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("PB-13 routes", () => {
  it("GET/POST /milestones, POST apply-template, PATCH, POST …/tasks, DELETE", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    const p = { teamId: team.id };

    const created = await callRoute(CREATE, { params: p, body: { title: "Kick-off" } });
    expect(created.status).toBe(201);
    const id = created.json.data.id as string;

    const applied = await callRoute(APPLY, {
      params: p,
      body: { templateKey: "presentation", finalDueAt: new Date(Date.now() + 20 * 86_400_000).toISOString() },
    });
    expect(applied.status).toBe(201);
    expect(applied.json.data).toHaveLength(5);

    const list = await callRoute(LIST, { params: p });
    expect(list.status).toBe(200);
    expect(list.json.data).toHaveLength(6);

    const patched = await callRoute(PATCH, {
      method: "PATCH",
      params: { ...p, milestoneId: id },
      body: { title: "Kick-off meeting" },
    });
    expect(patched.json.data.title).toBe("Kick-off meeting");

    const task = await makeTask(team.id, leader.id, { status: "DONE" });
    const linked = await callRoute(LINK, { params: { ...p, milestoneId: id }, body: { taskId: task.id } });
    expect(linked.status).toBe(200);
    expect(linked.json.data).toMatchObject({ taskCount: 1, doneCount: 1, percent: 100 });

    const deleted = await callRoute(DELETE, { method: "DELETE", params: { ...p, milestoneId: id } });
    expect(deleted.json.data).toEqual({ deleted: true });
  });

  it("validation: empty title, unknown template, past final date, missing task id → 400", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    const p = { teamId: team.id };
    const m = await createMilestone(team.id, leader.id, { title: "x" });

    expect((await callRoute(CREATE, { params: p, body: { title: "  " } })).status).toBe(400);
    expect((await callRoute(APPLY, { params: p, body: { templateKey: "thesis", finalDueAt: FINAL } })).status).toBe(
      400,
    );
    const past = await callRoute(APPLY, {
      params: p,
      body: { templateKey: "report", finalDueAt: "2020-01-01T00:00:00.000Z" },
    });
    expect(past.status).toBe(400);
    expect(past.json.error.message).toBe(PAST_FINAL_DATE_MESSAGE);
    expect((await callRoute(LINK, { params: { ...p, milestoneId: m.id }, body: {} })).status).toBe(400);
  });

  it("non-members 403, signed out 401", async () => {
    const { team } = await makeTeam();
    signInAs(await makeUser());
    expect((await callRoute(LIST, { params: { teamId: team.id } })).status).toBe(403);
    signOut();
    expect((await callRoute(LIST, { params: { teamId: team.id } })).status).toBe(401);
  });
});
