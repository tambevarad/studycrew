import type { ActivityDTO, ActivityTypeValue, EntityTypeValue, ListActivityQuery } from "@/contracts/activity";
import type { Page, UserSummaryDTO } from "@/contracts/common";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { errors } from "@/server/errors";
import { toUserSummary, userSummarySelect } from "@/server/mappers";
import { requireMembership } from "@/server/permissions";
import { decodeCursor, encodeCursor } from "./cursor";

/**
 * PB-09 · FR-06 — read side of the team activity history.
 * Writes happen elsewhere through logActivity() (src/server/activity.ts).
 */
export async function listActivity(
  teamId: string,
  actorId: string,
  query: ListActivityQuery,
): Promise<Page<ActivityDTO>> {
  await requireMembership(teamId, actorId);

  const where: Prisma.ActivityEventWhereInput = { teamId };
  if (query.type) where.type = query.type;
  if (query.entityType) where.entityType = query.entityType;
  if (query.actorId) where.actorId = query.actorId;
  if (query.cursor) {
    const c = decodeCursor(query.cursor);
    if (!c) throw errors.validation("That page link is no longer valid. Reload the activity list.");
    where.OR = [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }];
  }

  const rows = await db.activityEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    include: { actor: { select: userSummarySelect } },
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(toActivityDTO),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** Members to offer in the "Member" filter (current members, by name). */
export async function listActivityFilterMembers(teamId: string, actorId: string): Promise<UserSummaryDTO[]> {
  await requireMembership(teamId, actorId);
  const rows = await db.teamMember.findMany({
    where: { teamId },
    select: { user: { select: userSummarySelect } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => toUserSummary(r.user));
}

type Row = Prisma.ActivityEventGetPayload<{ include: { actor: { select: typeof userSummarySelect } } }>;

export function toActivityDTO(row: Row): ActivityDTO {
  return {
    id: row.id,
    teamId: row.teamId,
    type: row.type as ActivityTypeValue,
    entityType: row.entityType as EntityTypeValue,
    entityId: row.entityId,
    summary: row.summary,
    actor: row.actor ? toUserSummary(row.actor) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** ISO timestamp of this render, passed to client components that group by day. */
export function renderedAt(now: Date = new Date()): string {
  return now.toISOString();
}
