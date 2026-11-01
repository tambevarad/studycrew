/**
 * PB-11: turn an AI Coverage Check suggestion into a task, and rate whether it helped.
 * Tasks are written through PB-05's `createTask` / `deleteTask`; this service only writes `coverage_item`.
 */
import type { CoverageItemDTO, CreateTaskFromItemInput, RateItemInput } from "@/contracts/coverage";
import type { TaskDTO } from "@/contracts/tasks";
import { logActivity } from "@/server/activity";
import { db } from "@/server/db";
import { errors } from "@/server/errors";
import { requireMembership } from "@/server/permissions";
import { createTask, deleteTask } from "@/server/services/tasks/service";
import { taskDescriptionFor, taskTitleFor } from "./text";

export const TASK_EXISTS_MESSAGE = "A task already exists for this suggestion.";

const itemInclude = { report: { select: { teamId: true, title: true } } } as const;

/** The item, but only if it belongs to a report of this team (AC4: anything else is a 404). */
async function loadItemInTeam(teamId: string, itemId: string) {
  const item = await db.coverageItem.findUnique({ where: { id: itemId }, include: itemInclude });
  if (!item || item.report.teamId !== teamId) throw errors.notFound("That suggestion");
  return item;
}

function toItemDTO(item: Awaited<ReturnType<typeof loadItemInTeam>>): CoverageItemDTO {
  return {
    id: item.id,
    position: item.position,
    requirement: item.requirement,
    status: item.status,
    evidenceQuote: item.evidenceQuote,
    evidenceVerified: item.evidenceVerified,
    reason: item.reason,
    suggestion: item.suggestion,
    taskId: item.taskId,
    rating: item.rating,
  };
}

/**
 * AC1/AC2: creates a To Do task from the suggestion (High priority for Missing items) through PB-05, then links it to
 * the item. The two writes live in different services, so the link is a conditional update (`taskId: null`); a second
 * click that loses the race removes its own task and gets the same 409 as a later attempt.
 */
export async function createTaskFromItem(
  teamId: string,
  actorId: string,
  itemId: string,
  input: CreateTaskFromItemInput,
): Promise<TaskDTO> {
  await requireMembership(teamId, actorId);
  const item = await loadItemInTeam(teamId, itemId);
  if (item.taskId) throw errors.conflict(TASK_EXISTS_MESSAGE);

  const task = await createTask(teamId, actorId, {
    title: taskTitleFor(item),
    description: taskDescriptionFor(item, item.report.title),
    status: "TODO",
    priority: item.status === "MISSING" ? "HIGH" : "MEDIUM",
    assigneeIds: input.assigneeIds,
    dueAt: input.dueAt ?? null,
  });

  const linked = await db.coverageItem.updateMany({ where: { id: itemId, taskId: null }, data: { taskId: task.id } });
  if (linked.count === 0) {
    await deleteTask(teamId, actorId, task.id);
    throw errors.conflict(TASK_EXISTS_MESSAGE);
  }

  await logActivity({
    teamId,
    actorId,
    type: "COVERAGE_TASK_CREATED",
    entityType: "coverage",
    entityId: item.reportId,
    summary: `turned an AI suggestion into the task “${task.title}”`,
  });
  return task;
}

/** AC3: saves (or changes) this member's verdict; PB-16 reads it for the % helpful metric. */
export async function rateItem(
  teamId: string,
  actorId: string,
  itemId: string,
  input: RateItemInput,
): Promise<CoverageItemDTO> {
  await requireMembership(teamId, actorId);
  await loadItemInTeam(teamId, itemId);
  const updated = await db.coverageItem.update({
    where: { id: itemId },
    data: { rating: input.rating, ratedById: actorId },
    include: itemInclude,
  });
  return toItemDTO(updated);
}
