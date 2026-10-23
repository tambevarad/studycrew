/** PB-03 · FR-01 — the signed-in user's weekly availability. Writes `availability` only. */
import type { AvailabilityDTO, TeamAvailabilityDTO, UpdateAvailabilityInput } from "@/contracts/availability";
import { db } from "@/server/db";
import { errors } from "@/server/errors";
import { iso } from "@/server/mappers";
import { requireMembership } from "@/server/permissions";
import { getTeamAvailability } from "@/server/shared/team-availability";

const sortUnique = (slots: readonly number[]) => [...new Set(slots)].sort((a, b) => a - b);

/** Slots in the user's own time zone; empty with `updatedAt: null` if never saved. */
export async function getMyAvailability(userId: string): Promise<AvailabilityDTO> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true, availability: { select: { slots: true, updatedAt: true } } },
  });
  if (!user) throw errors.notFound("Your account");
  return {
    userId,
    timezone: user.timezone,
    slots: sortUnique(user.availability?.slots ?? []),
    updatedAt: iso(user.availability?.updatedAt),
  };
}

/** Replaces the whole weekly pattern (idempotent): duplicates removed, slots sorted. */
export async function setMyAvailability(userId: string, input: UpdateAvailabilityInput): Promise<AvailabilityDTO> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (!user) throw errors.notFound("Your account");
  const slots = sortUnique(input.slots);
  const row = await db.availability.upsert({
    where: { userId },
    create: { userId, slots },
    update: { slots },
  });
  return { userId, timezone: user.timezone, slots: row.slots, updatedAt: iso(row.updatedAt) };
}

/** Every member's slots + time zone, for teammates only (PB-06 reads the same shared helper). */
export async function getTeamAvailabilityFor(teamId: string, actorId: string): Promise<TeamAvailabilityDTO> {
  await requireMembership(teamId, actorId);
  return getTeamAvailability(teamId);
}
