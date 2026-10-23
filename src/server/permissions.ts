import type { TeamRole } from "@/generated/prisma/enums";
import { db, type DbOrTx } from "./db";
import { errors } from "./errors";

export interface Membership {
  teamId: string;
  userId: string;
  role: TeamRole;
}

/**
 * Throws 404 if the team does not exist and 403 if the user is not a member (NFR-02).
 * Call this BEFORE reading or validating anything else in a team-scoped operation.
 */
export async function requireMembership(teamId: string, userId: string, client: DbOrTx = db): Promise<Membership> {
  const member = await client.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { teamId: true, userId: true, role: true },
  });
  if (member) return member;
  const team = await client.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) throw errors.notFound("That team");
  throw errors.forbidden();
}

export async function requireLeader(teamId: string, userId: string, client: DbOrTx = db): Promise<Membership> {
  const m = await requireMembership(teamId, userId, client);
  if (m.role !== "LEADER") throw errors.forbidden("Only a team leader can do that.");
  return m;
}

export async function isMember(teamId: string, userId: string, client: DbOrTx = db): Promise<boolean> {
  const m = await client.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { userId: true } });
  return m !== null;
}

export async function getTeamMemberIds(teamId: string, client: DbOrTx = db): Promise<string[]> {
  const rows = await client.teamMember.findMany({ where: { teamId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Throws 400 unless every id is a member of the team (use for assignees). */
export async function assertAllMembers(teamId: string, userIds: string[], client: DbOrTx = db): Promise<void> {
  if (userIds.length === 0) return;
  const unique = [...new Set(userIds)];
  const count = await client.teamMember.count({ where: { teamId, userId: { in: unique } } });
  if (count !== unique.length) throw errors.validation("Everyone you assign must be a member of this team.");
}
