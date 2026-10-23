/**
 * PB-05 · FR-04 — Task board. Writes `task` and `task_assignee` only.
 * ★ `taskInclude`, `toTaskDTO`, `listTasks`, `createTask`, `updateTask` are used by PB-11/12/13 — keep the signatures.
 */
import type { UserSummaryDTO } from "@/contracts/common";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type CreateTaskInput,
  type ListTasksQuery,
  type MoveTaskInput,
  type TaskDTO,
  type TaskStatusValue,
  type UpdateTaskInput,
} from "@/contracts/tasks";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/server/activity";
import { db, type DbOrTx } from "@/server/db";
import { errors } from "@/server/errors";
import { iso, toUserSummary, userSummarySelect } from "@/server/mappers";
import { notify } from "@/server/notifications";
import { assertAllMembers, requireMembership } from "@/server/permissions";
import { POSITION_STEP, positionForIndex, rebalancedPositions } from "./positions";

export const taskInclude = {
  assignees: { include: { user: { select: userSummarySelect } }, orderBy: { assignedAt: "asc" } },
  createdBy: { select: userSummarySelect },
  coverageItem: { select: { id: true } },
} as const satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toTaskDTO(row: TaskRow, now: Date = new Date()): TaskDTO {
  return {
    id: row.id,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueAt: iso(row.dueAt),
    position: row.position,
    milestoneId: row.milestoneId,
    assignees: row.assignees.map((a) => toUserSummary(a.user)),
    createdBy: toUserSummary(row.createdBy),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    completedAt: iso(row.completedAt),
    isOverdue: row.dueAt !== null && row.dueAt < now && row.status !== "DONE",
    coverageItemId: row.coverageItem?.id ?? null,
  };
}

const boardLink = (teamId: string, taskId: string) => `/teams/${teamId}/board?task=${taskId}`;
const statusOrder = (s: TaskStatusValue) => TASK_STATUSES.indexOf(s);

async function findTeamTask(teamId: string, taskId: string, client: DbOrTx = db): Promise<TaskRow> {
  const task = await client.task.findFirst({ where: { id: taskId, teamId }, include: taskInclude });
  if (!task) throw errors.notFound("That task");
  return task;
}

async function assertMilestoneInTeam(teamId: string, milestoneId: string | null | undefined, client: DbOrTx = db) {
  if (!milestoneId) return;
  const m = await client.milestone.findFirst({ where: { id: milestoneId, teamId }, select: { id: true } });
  if (!m)
    throw errors.validation("That milestone isn't part of this team.", {
      fields: { milestoneId: "Choose a milestone from this team." },
    });
}

async function namesOf(userIds: string[], client: DbOrTx): Promise<string> {
  const users = await client.user.findMany({
    where: { id: { in: userIds } },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return joinList(users.map((u) => u.name));
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Tasks on the board, ordered by column (To Do → Done) then position. */
export async function listTasks(teamId: string, actorId: string, query: ListTasksQuery = {}): Promise<TaskDTO[]> {
  await requireMembership(teamId, actorId);
  const rows = await db.task.findMany({
    where: {
      teamId,
      status: query.status,
      milestoneId: query.milestoneId,
      assignees: query.assigneeId ? { some: { userId: query.assigneeId } } : undefined,
    },
    include: taskInclude,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const now = new Date();
  return rows.sort((a, b) => statusOrder(a.status) - statusOrder(b.status)).map((r) => toTaskDTO(r, now));
}

export async function getTask(teamId: string, actorId: string, taskId: string): Promise<TaskDTO> {
  await requireMembership(teamId, actorId);
  return toTaskDTO(await findTeamTask(teamId, taskId));
}

/** Team members who can be assigned, for the board's pickers. */
export async function listAssignableMembers(teamId: string, actorId: string): Promise<UserSummaryDTO[]> {
  await requireMembership(teamId, actorId);
  const rows = await db.teamMember.findMany({
    where: { teamId },
    select: { user: { select: userSummarySelect } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => toUserSummary(r.user));
}

/** Milestones for the task dialog's select (PB-13 owns creating them). */
export async function listMilestoneOptions(teamId: string, actorId: string): Promise<{ id: string; title: string }[]> {
  await requireMembership(teamId, actorId);
  return db.milestone.findMany({
    where: { teamId },
    select: { id: true, title: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

/** Adds a task at the bottom of its column. Activity TASK_CREATED; assignees (except the actor) get TASK_ASSIGNED. */
export async function createTask(teamId: string, actorId: string, input: CreateTaskInput): Promise<TaskDTO> {
  await requireMembership(teamId, actorId);
  const assigneeIds = [...new Set(input.assigneeIds ?? [])];
  await assertAllMembers(teamId, assigneeIds);
  await assertMilestoneInTeam(teamId, input.milestoneId);
  const status = input.status ?? "TODO";

  const task = await db.$transaction(async (tx) => {
    const last = await tx.task.aggregate({ where: { teamId, status }, _max: { position: true } });
    const t = await tx.task.create({
      data: {
        teamId,
        createdById: actorId,
        title: input.title,
        description: input.description || null,
        status,
        priority: input.priority ?? "MEDIUM",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        milestoneId: input.milestoneId ?? null,
        position: (last._max.position ?? 0) + POSITION_STEP,
        completedAt: status === "DONE" ? new Date() : null,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
      include: taskInclude,
    });
    await logActivity(
      { teamId, actorId, type: "TASK_CREATED", entityType: "task", entityId: t.id, summary: `created “${t.title}”` },
      tx,
    );
    await notify(
      {
        userIds: assigneeIds,
        exceptUserId: actorId,
        type: "TASK_ASSIGNED",
        teamId,
        title: `You were assigned “${t.title}”`,
        link: boardLink(teamId, t.id),
      },
      tx,
    );
    return t;
  });
  return toTaskDTO(task);
}

const FIELD_PHRASES = {
  title: "title",
  description: "description",
  priority: "priority",
  dueAt: "due date",
  milestoneId: "milestone",
} as const;

/**
 * Partial update. `assigneeIds` replaces the whole assignee set: newly added people get TASK_ASSIGNED (activity +
 * notification); other changes log one TASK_UPDATED naming what changed. Status changes go through `moveTask`.
 */
export async function updateTask(
  teamId: string,
  actorId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskDTO> {
  await requireMembership(teamId, actorId);
  const before = await findTeamTask(teamId, taskId);
  if (input.assigneeIds) await assertAllMembers(teamId, input.assigneeIds);
  if (input.milestoneId !== undefined) await assertMilestoneInTeam(teamId, input.milestoneId);

  const dueAt = input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null;
  const description = input.description === undefined ? undefined : input.description || null;
  const changed: (keyof typeof FIELD_PHRASES)[] = [];
  if (input.title !== undefined && input.title !== before.title) changed.push("title");
  if (description !== undefined && description !== before.description) changed.push("description");
  if (input.priority !== undefined && input.priority !== before.priority) changed.push("priority");
  if (dueAt !== undefined && (dueAt?.getTime() ?? null) !== (before.dueAt?.getTime() ?? null)) changed.push("dueAt");
  if (input.milestoneId !== undefined && input.milestoneId !== before.milestoneId) changed.push("milestoneId");

  const oldIds = new Set(before.assignees.map((a) => a.userId));
  const newIds = input.assigneeIds ? [...new Set(input.assigneeIds)] : null;
  const added = newIds ? newIds.filter((id) => !oldIds.has(id)) : [];
  const removed = newIds ? [...oldIds].filter((id) => !newIds.includes(id)) : [];

  const task = await db.$transaction(async (tx) => {
    if (newIds) {
      if (removed.length) await tx.taskAssignee.deleteMany({ where: { taskId, userId: { in: removed } } });
      if (added.length)
        await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId, userId })), skipDuplicates: true });
    }
    const t = await tx.task.update({
      where: { id: taskId },
      data: { title: input.title, description, priority: input.priority, dueAt, milestoneId: input.milestoneId },
      include: taskInclude,
    });
    const title = `“${t.title}”`;

    if (changed.length > 0 || removed.length > 0) {
      let summary: string;
      if (changed.length === 1 && changed[0] === "title" && removed.length === 0) {
        summary = `renamed “${before.title}” to ${title}`;
      } else if (changed.length === 0) {
        summary = `unassigned ${await namesOf(removed, tx)} from ${title}`;
      } else {
        const fields: string[] = changed.map((f) => FIELD_PHRASES[f]);
        if (removed.length) fields.push("assignees");
        summary = `changed the ${joinList(fields)} of ${title}`;
      }
      await logActivity(
        {
          teamId,
          actorId,
          type: "TASK_UPDATED",
          entityType: "task",
          entityId: t.id,
          summary,
          metadata: { fields: changed },
        },
        tx,
      );
    }
    if (added.length > 0) {
      await logActivity(
        {
          teamId,
          actorId,
          type: "TASK_ASSIGNED",
          entityType: "task",
          entityId: t.id,
          summary: `assigned ${await namesOf(added, tx)} to ${title}`,
          metadata: { userIds: added },
        },
        tx,
      );
      await notify(
        {
          userIds: added,
          exceptUserId: actorId,
          type: "TASK_ASSIGNED",
          teamId,
          title: `You were assigned ${title}`,
          link: boardLink(teamId, t.id),
        },
        tx,
      );
    }
    return t;
  });
  return toTaskDTO(task);
}

export async function deleteTask(teamId: string, actorId: string, taskId: string): Promise<{ deleted: true }> {
  await requireMembership(teamId, actorId);
  const task = await findTeamTask(teamId, taskId);
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });
    await logActivity(
      {
        teamId,
        actorId,
        type: "TASK_DELETED",
        entityType: "task",
        entityId: taskId,
        summary: `deleted “${task.title}”`,
      },
      tx,
    );
  });
  return { deleted: true };
}

/**
 * Puts a card in `status` at `index` (0-based, clamped). Only the moved card's position changes unless the gap is
 * too small, in which case the target column is renumbered in the same transaction. Entering Done sets `completedAt`
 * and logs TASK_COMPLETED; leaving Done clears it; other column changes log TASK_MOVED; reordering logs nothing.
 */
export async function moveTask(
  teamId: string,
  actorId: string,
  taskId: string,
  input: MoveTaskInput,
): Promise<TaskDTO> {
  await requireMembership(teamId, actorId);
  const before = await findTeamTask(teamId, taskId);

  const task = await db.$transaction(async (tx) => {
    const column = await tx.task.findMany({
      where: { teamId, status: input.status, id: { not: taskId } },
      select: { id: true, position: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const { position, needsRebalance } = positionForIndex(
      column.map((c) => c.position),
      input.index,
    );
    const entersDone = input.status === "DONE" && before.status !== "DONE";
    const leavesDone = input.status !== "DONE" && before.status === "DONE";
    const completedAt = entersDone ? new Date() : leavesDone ? null : undefined;

    if (needsRebalance) {
      const ids = column.map((c) => c.id);
      ids.splice(Math.min(input.index, ids.length), 0, taskId);
      const renumbered = rebalancedPositions(ids.length);
      for (const [i, id] of ids.entries()) {
        if (id !== taskId) await tx.task.update({ where: { id }, data: { position: renumbered[i] } });
      }
      await tx.task.update({
        where: { id: taskId },
        data: { status: input.status, completedAt, position: renumbered[ids.indexOf(taskId)] },
      });
    } else {
      await tx.task.update({ where: { id: taskId }, data: { status: input.status, position, completedAt } });
    }

    if (before.status !== input.status) {
      await logActivity(
        entersDone
          ? {
              teamId,
              actorId,
              type: "TASK_COMPLETED",
              entityType: "task",
              entityId: taskId,
              summary: `completed “${before.title}”`,
            }
          : {
              teamId,
              actorId,
              type: "TASK_MOVED",
              entityType: "task",
              entityId: taskId,
              summary: `moved “${before.title}” to ${TASK_STATUS_LABELS[input.status]}`,
              metadata: { from: before.status, to: input.status },
            },
        tx,
      );
    }
    return tx.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
  });
  return toTaskDTO(task);
}
