/**
 * PB-13 · FR-08 — milestones, templates, and progress from linked tasks.
 * Writes `milestone`; task links go through PB-05's `updateTask` (it owns `task`).
 */
import { percent, spreadDueDates } from "@/components/features/milestones/progress";
import {
  MILESTONE_TEMPLATES,
  type ApplyTemplateInput,
  type CreateMilestoneInput,
  type MilestoneDTO,
  type UpdateMilestoneInput,
} from "@/contracts/milestones";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/server/activity";
import { db, type DbOrTx } from "@/server/db";
import { errors } from "@/server/errors";
import { iso } from "@/server/mappers";
import { requireMembership } from "@/server/permissions";
import { updateTask } from "@/server/services/tasks/service";

export const PAST_FINAL_DATE_MESSAGE = "Pick a final due date in the future.";

const milestoneInclude = { tasks: { select: { status: true } } } as const;
type MilestoneRow = Prisma.MilestoneGetPayload<{ include: typeof milestoneInclude }>;

function toDTO(row: MilestoneRow): MilestoneDTO {
  const doneCount = row.tasks.filter((t) => t.status === "DONE").length;
  return {
    id: row.id,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    dueAt: iso(row.dueAt),
    templateKey: row.templateKey,
    position: row.position,
    taskCount: row.tasks.length,
    doneCount,
    percent: percent(doneCount, row.tasks.length),
  };
}

async function loadInTeam(teamId: string, milestoneId: string, client: DbOrTx = db): Promise<MilestoneRow> {
  const row = await client.milestone.findUnique({ where: { id: milestoneId }, include: milestoneInclude });
  if (!row || row.teamId !== teamId) throw errors.notFound("That milestone");
  return row;
}

async function nextPosition(teamId: string, client: DbOrTx): Promise<number> {
  const last = await client.milestone.aggregate({ where: { teamId }, _max: { position: true } });
  return (last._max.position ?? 0) + 1;
}

/** In `position` order, each with task counts and % done from its linked tasks. */
export async function listMilestones(teamId: string, actorId: string): Promise<MilestoneDTO[]> {
  await requireMembership(teamId, actorId);
  const rows = await db.milestone.findMany({
    where: { teamId },
    include: milestoneInclude,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDTO);
}

export async function createMilestone(
  teamId: string,
  actorId: string,
  input: CreateMilestoneInput,
): Promise<MilestoneDTO> {
  await requireMembership(teamId, actorId);
  const row = await db.$transaction(async (tx) => {
    const m = await tx.milestone.create({
      data: {
        teamId,
        title: input.title,
        description: input.description || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        position: await nextPosition(teamId, tx),
      },
      include: milestoneInclude,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "MILESTONE_CREATED",
        entityType: "milestone",
        entityId: m.id,
        summary: `added the milestone “${m.title}”`,
      },
      tx,
    );
    return m;
  });
  return toDTO(row);
}

/**
 * AC1: creates the template's milestones after any existing ones, due dates spread evenly from `now` to
 * `finalDueAt` (whole days in the actor's time zone when there is room), the last one on `finalDueAt`.
 */
export async function applyTemplate(
  teamId: string,
  actorId: string,
  input: ApplyTemplateInput,
  now: Date = new Date(),
): Promise<MilestoneDTO[]> {
  await requireMembership(teamId, actorId);
  const final = new Date(input.finalDueAt);
  if (final.getTime() <= now.getTime())
    throw errors.validation(PAST_FINAL_DATE_MESSAGE, { fields: { finalDueAt: PAST_FINAL_DATE_MESSAGE } });
  const template = MILESTONE_TEMPLATES[input.templateKey];
  const actor = await db.user.findUniqueOrThrow({ where: { id: actorId }, select: { timezone: true } });
  const dueDates = spreadDueDates(template.milestones.length, now, final, actor.timezone);

  const rows = await db.$transaction(async (tx) => {
    const start = await nextPosition(teamId, tx);
    const created: MilestoneRow[] = [];
    for (const [i, title] of template.milestones.entries()) {
      const m = await tx.milestone.create({
        data: { teamId, title, dueAt: dueDates[i], templateKey: input.templateKey, position: start + i },
        include: milestoneInclude,
      });
      await logActivity(
        {
          teamId,
          actorId,
          type: "MILESTONE_CREATED",
          entityType: "milestone",
          entityId: m.id,
          summary: `added the milestone “${m.title}” from the ${template.label} template`,
        },
        tx,
      );
      created.push(m);
    }
    return created;
  });
  return rows.map(toDTO);
}

export async function updateMilestone(
  teamId: string,
  actorId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<MilestoneDTO> {
  await requireMembership(teamId, actorId);
  const before = await loadInTeam(teamId, milestoneId);
  const row = await db.$transaction(async (tx) => {
    const m = await tx.milestone.update({
      where: { id: milestoneId },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
      },
      include: milestoneInclude,
    });
    const summary =
      input.title !== undefined && input.title !== before.title
        ? `renamed the milestone “${before.title}” to “${m.title}”`
        : `updated the milestone “${m.title}”`;
    await logActivity(
      { teamId, actorId, type: "MILESTONE_UPDATED", entityType: "milestone", entityId: m.id, summary },
      tx,
    );
    return m;
  });
  return toDTO(row);
}

/** AC3: the milestone goes; its tasks stay on the board, unlinked (`milestoneId` set null by the foreign key). */
export async function deleteMilestone(
  teamId: string,
  actorId: string,
  milestoneId: string,
): Promise<{ deleted: true }> {
  await requireMembership(teamId, actorId);
  const row = await loadInTeam(teamId, milestoneId);
  await db.$transaction(async (tx) => {
    await tx.milestone.delete({ where: { id: milestoneId } });
    await logActivity(
      {
        teamId,
        actorId,
        type: "MILESTONE_DELETED",
        entityType: "milestone",
        entityId: milestoneId,
        summary: `deleted the milestone “${row.title}”`,
      },
      tx,
    );
  });
  return { deleted: true };
}

/** AC2: links a task through PB-05 `updateTask` (which checks the task is in this team and logs TASK_UPDATED). */
export async function linkTask(
  teamId: string,
  actorId: string,
  milestoneId: string,
  taskId: string,
): Promise<MilestoneDTO> {
  await requireMembership(teamId, actorId);
  await loadInTeam(teamId, milestoneId);
  await updateTask(teamId, actorId, taskId, { milestoneId });
  return toDTO(await loadInTeam(teamId, milestoneId));
}
