import type { TeamAvailabilityDTO } from "@/contracts/availability";
import { db } from "../db";
import { toUserSummary, userSummarySelect } from "../mappers";

/**
 * Read-only: every member's weekly slots + timezone. Shared so PB-06 (meeting finder)
 * does not depend on PB-03 (availability editor). Caller must have checked membership.
 */
export async function getTeamAvailability(teamId: string): Promise<TeamAvailabilityDTO> {
  const members = await db.teamMember.findMany({
    where: { teamId },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { ...userSummarySelect, timezone: true, availability: { select: { slots: true } } } } },
  });
  return {
    teamId,
    members: members.map(({ user }) => ({
      user: toUserSummary(user),
      timezone: user.timezone,
      slots: [...(user.availability?.slots ?? [])].sort((a, b) => a - b),
    })),
  };
}
