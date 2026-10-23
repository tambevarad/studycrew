import type { CreateResourceInput, ListResourcesQuery, ResourceDTO, ResourceTypeValue, UpdateResourceInput } from "@/contracts/resources";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "../../activity";
import { db } from "../../db";
import { errors } from "../../errors";
import { toUserSummary, userSummarySelect } from "../../mappers";
import { requireMembership } from "../../permissions";

/** PB-07 · FR-05 — shared notes, links, and file references (links only; no uploads). */

const include = { createdBy: { select: userSummarySelect } } as const;
type Row = Prisma.ResourceGetPayload<{ include: typeof include }>;

const NOUN: Record<ResourceTypeValue, string> = { NOTE: "note", LINK: "link", FILE_REF: "file" };

export function toResourceDTO(row: Row): ResourceDTO {
  return {
    id: row.id,
    teamId: row.teamId,
    type: row.type,
    title: row.title,
    url: row.url,
    body: row.body,
    pinned: row.pinned,
    createdBy: toUserSummary(row.createdBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Pinned first, then newest. `q` matches title or note text, case-insensitively. */
export async function listResources(teamId: string, actorId: string, query: ListResourcesQuery): Promise<ResourceDTO[]> {
  await requireMembership(teamId, actorId);
  const where: Prisma.ResourceWhereInput = { teamId };
  if (query.type) where.type = query.type;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { body: { contains: query.q, mode: "insensitive" } },
    ];
  }
  const rows = await db.resource.findMany({ where, include, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
  return rows.map(toResourceDTO);
}

export async function createResource(teamId: string, actorId: string, input: CreateResourceInput): Promise<ResourceDTO> {
  await requireMembership(teamId, actorId);
  const row = await db.$transaction(async (tx) => {
    const created = await tx.resource.create({
      data: {
        teamId,
        createdById: actorId,
        type: input.type,
        title: input.title,
        url: input.type === "NOTE" ? null : input.url,
        body: input.type === "NOTE" ? input.body : null,
      },
      include,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "RESOURCE_ADDED",
        entityType: "resource",
        entityId: created.id,
        summary: `added the ${NOUN[created.type]} “${created.title}”`,
      },
      tx,
    );
    return created;
  });
  return toResourceDTO(row);
}

async function loadInTeam(teamId: string, resourceId: string) {
  const row = await db.resource.findUnique({ where: { id: resourceId }, include });
  if (!row || row.teamId !== teamId) throw errors.notFound("That resource");
  return row;
}

/**
 * Any member may pin/unpin. Editing title/url/body needs the creator or a leader.
 * `url` only applies to links and file references; `body` only to notes.
 */
export async function updateResource(
  teamId: string,
  actorId: string,
  resourceId: string,
  input: UpdateResourceInput,
): Promise<ResourceDTO> {
  const membership = await requireMembership(teamId, actorId);
  const existing = await loadInTeam(teamId, resourceId);

  const editsContent = input.title !== undefined || input.url !== undefined || input.body !== undefined;
  if (editsContent && existing.createdById !== actorId && membership.role !== "LEADER") {
    throw errors.forbidden("Only the person who added this or a team leader can edit it. Anyone can pin it.");
  }
  if (input.url !== undefined && existing.type === "NOTE") {
    throw errors.validation("Notes don't have a link. Edit the note text instead.", { fields: { url: "Notes don't have a link." } });
  }
  if (input.body !== undefined && existing.type !== "NOTE") {
    throw errors.validation("Only notes have text. Edit the link instead.", { fields: { body: "Only notes have text." } });
  }
  if (input.body !== undefined && input.body.length === 0) {
    throw errors.validation("Write something in the note.", { fields: { body: "Write something in the note." } });
  }

  const row = await db.$transaction(async (tx) => {
    const updated = await tx.resource.update({
      where: { id: resourceId },
      data: { title: input.title, url: input.url, body: input.body, pinned: input.pinned },
      include,
    });
    const pinChanged = input.pinned !== undefined && input.pinned !== existing.pinned;
    if (editsContent || pinChanged) {
      const summary = editsContent
        ? `updated the ${NOUN[updated.type]} “${updated.title}”`
        : `${updated.pinned ? "pinned" : "unpinned"} “${updated.title}”`;
      await logActivity(
        { teamId, actorId, type: "RESOURCE_UPDATED", entityType: "resource", entityId: updated.id, summary, metadata: pinChanged ? { pinned: updated.pinned } : undefined },
        tx,
      );
    }
    return updated;
  });
  return toResourceDTO(row);
}

export async function deleteResource(teamId: string, actorId: string, resourceId: string): Promise<{ deleted: true }> {
  const membership = await requireMembership(teamId, actorId);
  const existing = await loadInTeam(teamId, resourceId);
  if (existing.createdById !== actorId && membership.role !== "LEADER") {
    throw errors.forbidden("Only the person who added this or a team leader can delete it.");
  }
  await db.$transaction(async (tx) => {
    await tx.resource.delete({ where: { id: resourceId } });
    await logActivity(
      {
        teamId,
        actorId,
        type: "RESOURCE_DELETED",
        entityType: "resource",
        entityId: resourceId,
        summary: `deleted the ${NOUN[existing.type]} “${existing.title}”`,
      },
      tx,
    );
  });
  return { deleted: true };
}
