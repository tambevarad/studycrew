/**
 * PB-08 · FR-05 — reading notifications, read state, and the lazy due-soon generator (ADR 5).
 * Other features create notifications with notify(); this service only writes read state and TASK_DUE_SOON rows.
 */
import type { Page } from "@/contracts/common";
import {
  DUE_SOON_HOURS,
  type ListNotificationsQuery,
  type MarkReadInput,
  type NotificationDTO,
  type UnreadCountDTO,
} from "@/contracts/notifications";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/server/db";
import { errors } from "@/server/errors";
import { iso } from "@/server/mappers";
import { notify } from "@/server/notifications";

const HOUR_MS = 3_600_000;

type NotificationRow = Prisma.NotificationGetPayload<object>;

function toNotificationDTO(n: NotificationRow): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    teamId: n.teamId,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: iso(n.readAt),
    createdAt: iso(n.createdAt),
  };
}

/** "is due in 5 h" / "is due in under an hour". */
export function dueInPhrase(dueAt: Date, now: Date): string {
  const hours = Math.round((dueAt.getTime() - now.getTime()) / HOUR_MS);
  return hours < 1 ? "is due in under an hour" : `is due in ${hours} h`;
}

/**
 * Creates one TASK_DUE_SOON per task assigned to the user that isn't Done and is due in (now, now + 24 h].
 * Idempotent through `dedupeKey = due:<taskId>:<dueAt ISO>`, so re-dating a task produces a new reminder.
 * Returns how many notifications were created.
 */
export async function generateDueSoonNotifications(userId: string, now: Date = new Date()): Promise<number> {
  const until = new Date(now.getTime() + DUE_SOON_HOURS * HOUR_MS);
  const tasks = await db.task.findMany({
    where: {
      status: { not: "DONE" },
      dueAt: { gt: now, lte: until },
      assignees: { some: { userId } },
      team: { members: { some: { userId } } },
    },
    select: { id: true, title: true, dueAt: true, teamId: true, team: { select: { name: true } } },
  });
  if (tasks.length === 0) return 0;
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  let created = 0;
  for (const t of tasks) {
    const dueAt = t.dueAt!;
    created += await notify({
      userIds: [userId],
      type: "TASK_DUE_SOON",
      teamId: t.teamId,
      title: `“${t.title}” ${dueInPhrase(dueAt, now)}`,
      body: `Due ${formatDateTime(dueAt.toISOString(), user?.timezone)}`,
      link: `/teams/${t.teamId}/board?task=${t.id}`,
      dedupeKey: `due:${t.id}:${dueAt.toISOString()}`,
    });
  }
  return created;
}

/** Newest first; cursor = the last item's id, ordered by (createdAt, id) so pages are stable. */
export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
  now: Date = new Date(),
): Promise<Page<NotificationDTO>> {
  await generateDueSoonNotifications(userId, now);
  const where: Prisma.NotificationWhereInput = { userId, readAt: query.unreadOnly ? null : undefined };
  if (query.cursor) {
    const after = await db.notification.findFirst({
      where: { id: query.cursor, userId },
      select: { id: true, createdAt: true },
    });
    if (!after) throw errors.validation("That page of notifications is no longer available. Reload the page.");
    where.OR = [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }];
  }
  const rows = await db.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const items = rows.slice(0, query.limit).map(toNotificationDTO);
  return { items, nextCursor: rows.length > query.limit ? items[items.length - 1].id : null };
}

export async function unreadCount(userId: string, now: Date = new Date()): Promise<UnreadCountDTO> {
  await generateDueSoonNotifications(userId, now);
  return { count: await db.notification.count({ where: { userId, readAt: null } }) };
}

/** Marks the caller's own notifications read (other users' ids are ignored). */
export async function markRead(
  userId: string,
  input: MarkReadInput,
  now: Date = new Date(),
): Promise<{ updated: number }> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null, id: input.all ? undefined : { in: input.ids ?? [] } },
    data: { readAt: now },
  });
  return { updated: result.count };
}

/** Names of the teams the user's notifications point at (the DTO carries only `teamId`). */
export async function notificationTeamNames(userId: string): Promise<Record<string, string>> {
  const rows = await db.notification.findMany({
    where: { userId, teamId: { not: null } },
    distinct: ["teamId"],
    select: { teamId: true },
  });
  const teams = await db.team.findMany({
    where: { id: { in: rows.map((r) => r.teamId!) } },
    select: { id: true, name: true },
  });
  return Object.fromEntries(teams.map((t) => [t.id, t.name]));
}
