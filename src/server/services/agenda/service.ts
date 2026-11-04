import type { AgendaItemDTO, CreateAgendaItemInput } from "@/contracts/agenda";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/server/activity";
import { db } from "@/server/db";
import { errors } from "@/server/errors";
import { toUserSummary, userSummarySelect } from "@/server/mappers";
import { requireMembership } from "@/server/permissions";
import { getMeeting } from "@/server/services/meetings/service";

/** PB-15 · FR-10 — agenda topics for a meeting, and who needs help with each. */

/** `helpFlags` is narrowed to the viewer's own flag; `_count` has everyone's. */
const includeFor = (viewerId: string) =>
  ({
    author: { select: userSummarySelect },
    helpFlags: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { helpFlags: true } },
  }) as const;
type Row = Prisma.AgendaItemGetPayload<{ include: ReturnType<typeof includeFor> }>;

function toAgendaItemDTO(row: Row): AgendaItemDTO {
  return {
    id: row.id,
    meetingId: row.meetingId,
    title: row.title,
    notes: row.notes,
    author: toUserSummary(row.author),
    helpCount: row._count.helpFlags,
    flaggedByMe: row.helpFlags.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadInMeeting(meetingId: string, itemId: string, viewerId: string): Promise<Row> {
  const row = await db.agendaItem.findUnique({ where: { id: itemId }, include: includeFor(viewerId) });
  if (!row || row.meetingId !== meetingId) throw errors.notFound("That topic");
  return row;
}

/** AC1: most-flagged first, then oldest first. `getMeeting` checks membership and that the meeting is in this team (AC3). */
export async function listAgenda(teamId: string, actorId: string, meetingId: string): Promise<AgendaItemDTO[]> {
  await getMeeting(teamId, actorId, meetingId);
  const rows = await db.agendaItem.findMany({
    where: { meetingId },
    include: includeFor(actorId),
    orderBy: [{ helpFlags: { _count: "desc" } }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toAgendaItemDTO);
}

export async function addAgendaItem(
  teamId: string,
  actorId: string,
  meetingId: string,
  input: CreateAgendaItemInput,
): Promise<AgendaItemDTO> {
  const meeting = await getMeeting(teamId, actorId, meetingId);
  const row = await db.$transaction(async (tx) => {
    const created = await tx.agendaItem.create({
      data: { meetingId, authorId: actorId, title: input.title, notes: input.notes || null },
      include: includeFor(actorId),
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "AGENDA_ITEM_ADDED",
        entityType: "meeting",
        entityId: meetingId,
        summary: `added “${created.title}” to the agenda of “${meeting.title}”`,
      },
      tx,
    );
    return created;
  });
  return toAgendaItemDTO(row);
}

/** AC2: idempotent per member, so sending the same value twice changes nothing. */
export async function setHelpFlag(
  teamId: string,
  actorId: string,
  meetingId: string,
  itemId: string,
  input: { needsHelp: boolean },
): Promise<AgendaItemDTO> {
  await getMeeting(teamId, actorId, meetingId);
  await loadInMeeting(meetingId, itemId, actorId);
  if (input.needsHelp) {
    await db.agendaHelpFlag.createMany({ data: [{ agendaItemId: itemId, userId: actorId }], skipDuplicates: true });
  } else {
    await db.agendaHelpFlag.deleteMany({ where: { agendaItemId: itemId, userId: actorId } });
  }
  return toAgendaItemDTO(await loadInMeeting(meetingId, itemId, actorId));
}

/** AC3: the person who added the topic or a leader. Its help flags cascade. */
export async function deleteAgendaItem(
  teamId: string,
  actorId: string,
  meetingId: string,
  itemId: string,
): Promise<{ deleted: true }> {
  await getMeeting(teamId, actorId, meetingId);
  const membership = await requireMembership(teamId, actorId);
  const item = await loadInMeeting(meetingId, itemId, actorId);
  if (item.authorId !== actorId && membership.role !== "LEADER") {
    throw errors.forbidden("Only the person who added this topic or a team leader can delete it.");
  }
  await db.agendaItem.delete({ where: { id: itemId } });
  return { deleted: true };
}
