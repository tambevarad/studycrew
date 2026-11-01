import { describe, expect, it, vi } from "vitest";
import { PUT as RATE } from "@/app/api/v1/teams/[teamId]/coverage-items/[itemId]/rating/route";
import { POST as CREATE_TASK } from "@/app/api/v1/teams/[teamId]/coverage-items/[itemId]/task/route";
import type { CoverageStatusValue } from "@/contracts/coverage";
import { db } from "@/server/db";
import { createTaskFromItem, rateItem, TASK_EXISTS_MESSAGE } from "@/server/services/coverage-actions/service";
import { listTasks } from "@/server/services/tasks/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

type ItemSeed = { requirement: string; status: CoverageStatusValue; reason?: string; suggestion?: string | null };

/** A finished report with the given items, as PB-10 would have saved it. */
async function makeReport(teamId: string, authorId: string, items: ItemSeed[], title = "Psych 101 presentation") {
  return db.coverageReport.create({
    data: {
      teamId,
      authorId,
      title,
      workType: "PRESENTATION",
      instructions: "Your presentation must cover the listed points.",
      draft: "Social media helps students stay connected.",
      status: "COMPLETED",
      score: 50,
      provider: "mock",
      model: "keyword-mock-v1",
      promptVersion: "v1",
      latencyMs: 5,
      items: {
        create: items.map((it, position) => ({
          position,
          requirement: it.requirement,
          status: it.status,
          reason: it.reason ?? "Nothing in the draft addresses this requirement.",
          suggestion: it.suggestion === undefined ? `Add a section that covers: ${it.requirement}.` : it.suggestion,
        })),
      },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });
}

const PSYCH_ITEMS: ItemSeed[] = [
  { requirement: "Cite at least three peer-reviewed sources in APA format", status: "MISSING" },
  {
    requirement: "Explain the drawbacks of social media with research examples",
    status: "PARTIAL",
    reason: "The draft touches on this but leaves parts out.",
  },
  { requirement: "Explain the benefits of social media with research examples", status: "COVERED", suggestion: null },
];

async function setup() {
  const { team, leader, members } = await makeTeam({ members: 2 });
  const report = await makeReport(team.id, leader.id, PSYCH_ITEMS);
  const [missing, partial, covered] = report.items;
  return { team, leader, members, report, missing, partial, covered };
}

describe("PB-11 createTaskFromItem", () => {
  it("AC1: a Missing item becomes a High-priority To Do task titled with the suggestion, linked to the item", async () => {
    const { team, leader, report, missing } = await setup();

    const task = await createTaskFromItem(team.id, leader.id, missing.id, { assigneeIds: [] });

    expect(task).toMatchObject({ status: "TODO", priority: "HIGH", title: missing.suggestion });
    expect(task.description).toBe(
      `From AI Coverage Check “${report.title}”: ${missing.requirement} — Nothing in the draft addresses this requirement.`,
    );
    expect((await db.coverageItem.findUniqueOrThrow({ where: { id: missing.id } })).taskId).toBe(task.id);
    const events = await db.activityEvent.findMany({ where: { teamId: team.id, type: "COVERAGE_TASK_CREATED" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: leader.id, entityType: "coverage", entityId: report.id });
    expect(events[0].summary).toContain(task.title);
  });

  it("AC1: a second attempt is a 409 with a friendly message, and no extra task is made", async () => {
    const { team, leader, members, missing } = await setup();
    await createTaskFromItem(team.id, leader.id, missing.id, { assigneeIds: [] });

    await expect(createTaskFromItem(team.id, members[0].id, missing.id, { assigneeIds: [] })).rejects.toMatchObject({
      code: "CONFLICT",
      message: TASK_EXISTS_MESSAGE,
    });
    expect(await db.task.count({ where: { teamId: team.id } })).toBe(1);
  });

  it("AC1: a double click that races still leaves exactly one task linked to the item", async () => {
    const { team, leader, missing } = await setup();

    const results = await Promise.allSettled([
      createTaskFromItem(team.id, leader.id, missing.id, { assigneeIds: [] }),
      createTaskFromItem(team.id, leader.id, missing.id, { assigneeIds: [] }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    const tasks = await db.task.findMany({ where: { teamId: team.id } });
    expect(tasks).toHaveLength(1);
    expect((await db.coverageItem.findUniqueOrThrow({ where: { id: missing.id } })).taskId).toBe(tasks[0].id);
  });

  it("a Partial item gets Medium priority; with no suggestion the requirement becomes the title", async () => {
    const { team, leader } = await setup();
    const report = await makeReport(team.id, leader.id, [
      { requirement: "Conclude with a recommendation for students", status: "PARTIAL", suggestion: null },
    ]);

    const task = await createTaskFromItem(team.id, leader.id, report.items[0].id, { assigneeIds: [] });

    expect(task).toMatchObject({ priority: "MEDIUM", title: "Conclude with a recommendation for students" });
  });

  it("AC2: the task shows on the board with its assignees and due date, and assignees (not the actor) are notified", async () => {
    const { team, leader, members, partial } = await setup();
    const dueAt = "2026-11-06T05:59:00.000Z";

    const task = await createTaskFromItem(team.id, leader.id, partial.id, {
      assigneeIds: [members[0].id, leader.id],
      dueAt,
    });

    const board = await listTasks(team.id, members[1].id, {});
    const onBoard = board.find((t) => t.id === task.id);
    expect(onBoard).toMatchObject({ status: "TODO", dueAt });
    expect(onBoard?.assignees.map((a) => a.id).sort()).toEqual([members[0].id, leader.id].sort());
    expect(await db.notification.count({ where: { userId: members[0].id, type: "TASK_ASSIGNED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: leader.id, type: "TASK_ASSIGNED" } })).toBe(0);
  });

  it("assigning someone outside the team is a 400 and leaves the item unlinked", async () => {
    const { team, leader, missing } = await setup();
    const stranger = await makeUser();

    await expect(
      createTaskFromItem(team.id, leader.id, missing.id, { assigneeIds: [stranger.id] }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect((await db.coverageItem.findUniqueOrThrow({ where: { id: missing.id } })).taskId).toBeNull();
  });

  it("AC4: an item from another team's report is a 404; a non-member is a 403", async () => {
    const { team, leader, missing } = await setup();
    const other = await makeTeam();

    await expect(
      createTaskFromItem(other.team.id, other.leader.id, missing.id, { assigneeIds: [] }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(createTaskFromItem(team.id, other.leader.id, missing.id, { assigneeIds: [] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createTaskFromItem(team.id, leader.id, "no-such-item", { assigneeIds: [] })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("PB-11 rateItem", () => {
  it("AC3: a rating saves, records who rated, and can be changed", async () => {
    const { team, leader, members, missing } = await setup();

    const first = await rateItem(team.id, leader.id, missing.id, { rating: "HELPFUL" });
    expect(first).toMatchObject({ id: missing.id, rating: "HELPFUL", status: "MISSING" });

    const changed = await rateItem(team.id, members[0].id, missing.id, { rating: "NOT_HELPFUL" });
    expect(changed.rating).toBe("NOT_HELPFUL");
    expect(await db.coverageItem.findUniqueOrThrow({ where: { id: missing.id } })).toMatchObject({
      rating: "NOT_HELPFUL",
      ratedById: members[0].id,
    });
  });

  it("AC3: the ratings give PB-16 a % helpful", async () => {
    const { team, leader, missing, partial, covered } = await setup();
    await rateItem(team.id, leader.id, missing.id, { rating: "HELPFUL" });
    await rateItem(team.id, leader.id, partial.id, { rating: "HELPFUL" });
    await rateItem(team.id, leader.id, covered.id, { rating: "NOT_HELPFUL" });

    const rated = await db.coverageItem.findMany({ where: { report: { teamId: team.id }, rating: { not: null } } });
    const helpful = Math.round((rated.filter((i) => i.rating === "HELPFUL").length / rated.length) * 100);
    expect(helpful).toBe(67);
  });

  it("AC4: another team's item is a 404; a non-member is a 403", async () => {
    const { team, missing } = await setup();
    const other = await makeTeam();

    await expect(rateItem(other.team.id, other.leader.id, missing.id, { rating: "HELPFUL" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(rateItem(team.id, other.leader.id, missing.id, { rating: "HELPFUL" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("PB-11 routes", () => {
  it("POST …/coverage-items/:itemId/task → 201 with the task, then 409", async () => {
    const { team, leader, missing } = await setup();
    signInAs(leader);
    const params = { teamId: team.id, itemId: missing.id };

    const res = await callRoute(CREATE_TASK, { params, body: { assigneeIds: [] } });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ priority: "HIGH", status: "TODO", title: missing.suggestion });

    const again = await callRoute(CREATE_TASK, { params, body: {} });
    expect(again.status).toBe(409);
    expect(again.json.error.message).toBe(TASK_EXISTS_MESSAGE);
  });

  it("PUT …/coverage-items/:itemId/rating → 200 with the item; a bad rating is a 400", async () => {
    const { team, leader, partial } = await setup();
    signInAs(leader);
    const params = { teamId: team.id, itemId: partial.id };

    const res = await callRoute(RATE, { method: "PUT", params, body: { rating: "HELPFUL" } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ id: partial.id, rating: "HELPFUL" });

    const bad = await callRoute(RATE, { method: "PUT", params, body: { rating: "MAYBE" } });
    expect(bad.status).toBe(400);
  });

  it("AC4: non-members get 403 and signed-out callers 401 on both routes", async () => {
    const { team, missing } = await setup();
    const params = { teamId: team.id, itemId: missing.id };

    signInAs(await makeUser());
    expect((await callRoute(CREATE_TASK, { params, body: {} })).status).toBe(403);
    expect((await callRoute(RATE, { method: "PUT", params, body: { rating: "HELPFUL" } })).status).toBe(403);

    signOut();
    expect((await callRoute(CREATE_TASK, { params, body: {} })).status).toBe(401);
    expect((await callRoute(RATE, { method: "PUT", params, body: { rating: "HELPFUL" } })).status).toBe(401);
  });
});
