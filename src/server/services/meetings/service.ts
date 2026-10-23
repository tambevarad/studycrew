import type { UserSummaryDTO } from "@/contracts/common";
import {
  MAX_MEETING_MINUTES,
  type CreateMeetingInput,
  type ListMeetingsQuery,
  type MeetingDTO,
  type MeetingSuggestionDTO,
  type MeetingSuggestionsQuery,
  type RsvpInput,
  type RsvpValue,
  type UpdateMeetingInput,
} from "@/contracts/meetings";
import { addDays, daysBetween, isValidDateKey, zonedInstant } from "@/components/features/meetings/calendar-dates";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "../../activity";
import { db, type Tx } from "../../db";
import { errors } from "../../errors";
import { toUserSummary, userSummarySelect } from "../../mappers";
import { notify } from "../../notifications";
import { getTeamMemberIds, requireMembership, type Membership } from "../../permissions";
import { getTeamAvailability } from "../../shared/team-availability";
import { suggestMeetingTimes, weekAvailability } from "./meeting-finder";

/** PB-06 · FR-03 — team meetings, RSVPs, and suggested times. */

export const meetingInclude = {
  createdBy: { select: userSummarySelect },
  rsvps: { include: { user: { select: userSummarySelect } }, orderBy: { respondedAt: "asc" } },
} as const satisfies Prisma.MeetingInclude;
type Row = Prisma.MeetingGetPayload<{ include: typeof meetingInclude }>;

export const MAX_SUGGESTION_DAYS = 31;

export function toMeetingDTO(row: Row, viewerId: string): MeetingDTO {
  return {
    id: row.id,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    createdBy: toUserSummary(row.createdBy),
    rsvps: row.rsvps.map((r) => ({ user: toUserSummary(r.user), response: r.response })),
    myRsvp: row.rsvps.find((r) => r.userId === viewerId)?.response ?? null,
  };
}

/** Meetings that overlap [from, to). */
export async function listMeetings(teamId: string, actorId: string, query: ListMeetingsQuery): Promise<MeetingDTO[]> {
  await requireMembership(teamId, actorId);
  const rows = await db.meeting.findMany({
    where: { teamId, startsAt: { lt: new Date(query.to) }, endsAt: { gt: new Date(query.from) } },
    include: meetingInclude,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return rows.map((r) => toMeetingDTO(r, actorId));
}

async function loadInTeam(teamId: string, meetingId: string, client: typeof db | Tx = db): Promise<Row> {
  const row = await client.meeting.findUnique({ where: { id: meetingId }, include: meetingInclude });
  if (!row || row.teamId !== teamId) throw errors.notFound("That meeting");
  return row;
}

export async function getMeeting(teamId: string, actorId: string, meetingId: string): Promise<MeetingDTO> {
  await requireMembership(teamId, actorId);
  return toMeetingDTO(await loadInTeam(teamId, meetingId), actorId);
}

/** "Thu, Oct 29, 7:00 PM CDT" — notifications go to everyone, so the zone name is included. */
function whenText(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(startsAt);
}

async function actorTimeZone(actorId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: actorId }, select: { timezone: true } });
  return u?.timezone ?? "America/Chicago";
}

function assertRange(startsAt: Date, endsAt: Date) {
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (!(minutes > 0 && minutes <= MAX_MEETING_MINUTES)) {
    throw errors.validation("End time must be after the start and within 8 hours.", {
      fields: { endsAt: "End time must be after the start and within 8 hours." },
    });
  }
}

export async function createMeeting(teamId: string, actorId: string, input: CreateMeetingInput): Promise<MeetingDTO> {
  await requireMembership(teamId, actorId);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  assertRange(startsAt, endsAt);
  const tz = await actorTimeZone(actorId);

  const row = await db.$transaction(async (tx) => {
    const created = await tx.meeting.create({
      data: {
        teamId,
        createdById: actorId,
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        startsAt,
        endsAt,
        // The organizer is going by default; they can change it.
        rsvps: { create: { userId: actorId, response: "YES" } },
      },
      include: meetingInclude,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "MEETING_CREATED",
        entityType: "meeting",
        entityId: created.id,
        summary: `scheduled “${created.title}”`,
        metadata: { startsAt: created.startsAt.toISOString() },
      },
      tx,
    );
    await notify(
      {
        userIds: await getTeamMemberIds(teamId, tx),
        exceptUserId: actorId,
        type: "MEETING_SCHEDULED",
        teamId,
        title: `New meeting: “${created.title}”`,
        body: `${whenText(startsAt, tz)}${created.location ? ` · ${created.location}` : ""}. Let the team know if you can come.`,
        link: `/teams/${teamId}/calendar/${created.id}`,
      },
      tx,
    );
    return created;
  });
  return toMeetingDTO(row, actorId);
}

function requireOrganizerOrLeader(row: Row, actorId: string, membership: Membership, verb: string) {
  if (row.createdById !== actorId && membership.role !== "LEADER") {
    throw errors.forbidden(`Only the person who scheduled this meeting or a team leader can ${verb} it.`);
  }
}

export async function updateMeeting(
  teamId: string,
  actorId: string,
  meetingId: string,
  input: UpdateMeetingInput,
): Promise<MeetingDTO> {
  const membership = await requireMembership(teamId, actorId);
  const existing = await loadInTeam(teamId, meetingId);
  requireOrganizerOrLeader(existing, actorId, membership, "change");

  const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
  assertRange(startsAt, endsAt);
  const timeChanged =
    startsAt.getTime() !== existing.startsAt.getTime() || endsAt.getTime() !== existing.endsAt.getTime();
  const location = input.location === undefined ? existing.location : input.location || null;
  const placeChanged = location !== existing.location;
  const tz = await actorTimeZone(actorId);

  const row = await db.$transaction(async (tx) => {
    const updated = await tx.meeting.update({
      where: { id: meetingId },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        location,
        startsAt,
        endsAt,
      },
      include: meetingInclude,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "MEETING_UPDATED",
        entityType: "meeting",
        entityId: meetingId,
        summary: timeChanged ? `moved “${updated.title}”` : `updated “${updated.title}”`,
        metadata: timeChanged ? { from: existing.startsAt.toISOString(), to: startsAt.toISOString() } : undefined,
      },
      tx,
    );
    if (timeChanged || placeChanged) {
      await notify(
        {
          userIds: await getTeamMemberIds(teamId, tx),
          exceptUserId: actorId,
          type: "MEETING_UPDATED",
          teamId,
          title: timeChanged ? `“${updated.title}” was moved` : `“${updated.title}” has a new location`,
          body: `Now ${whenText(startsAt, tz)}${location ? ` · ${location}` : ""}.`,
          link: `/teams/${teamId}/calendar/${meetingId}`,
        },
        tx,
      );
    }
    return updated;
  });
  return toMeetingDTO(row, actorId);
}

export async function deleteMeeting(teamId: string, actorId: string, meetingId: string): Promise<{ deleted: true }> {
  const membership = await requireMembership(teamId, actorId);
  const existing = await loadInTeam(teamId, meetingId);
  requireOrganizerOrLeader(existing, actorId, membership, "cancel");
  const tz = await actorTimeZone(actorId);

  await db.$transaction(async (tx) => {
    await tx.meeting.delete({ where: { id: meetingId } });
    await logActivity(
      {
        teamId,
        actorId,
        type: "MEETING_CANCELLED",
        entityType: "meeting",
        entityId: meetingId,
        summary: `cancelled “${existing.title}”`,
      },
      tx,
    );
    await notify(
      {
        userIds: await getTeamMemberIds(teamId, tx),
        exceptUserId: actorId,
        type: "MEETING_UPDATED",
        teamId,
        title: `“${existing.title}” was cancelled`,
        body: `It was planned for ${whenText(existing.startsAt, tz)}.`,
        link: `/teams/${teamId}/calendar`,
      },
      tx,
    );
  });
  return { deleted: true };
}

const RSVP_PHRASE: Record<RsvpValue, string> = { YES: "is going to", MAYBE: "might join", NO: "can't make" };

export async function setRsvp(
  teamId: string,
  actorId: string,
  meetingId: string,
  input: RsvpInput,
): Promise<MeetingDTO> {
  await requireMembership(teamId, actorId);
  const existing = await loadInTeam(teamId, meetingId);
  const previous = existing.rsvps.find((r) => r.userId === actorId)?.response;

  const row = await db.$transaction(async (tx) => {
    await tx.meetingRsvp.upsert({
      where: { meetingId_userId: { meetingId, userId: actorId } },
      create: { meetingId, userId: actorId, response: input.response },
      update: { response: input.response, respondedAt: new Date() },
    });
    if (previous !== input.response) {
      await logActivity(
        {
          teamId,
          actorId,
          type: "MEETING_RSVP",
          entityType: "meeting",
          entityId: meetingId,
          summary: `${RSVP_PHRASE[input.response]} “${existing.title}”`,
          metadata: { response: input.response },
        },
        tx,
      );
    }
    return loadInTeam(teamId, meetingId, tx);
  });
  return toMeetingDTO(row, actorId);
}

function validateSuggestionQuery(q: MeetingSuggestionsQuery) {
  if (!isValidDateKey(q.from) || !isValidDateKey(q.to)) throw errors.validation("Pick real dates.");
  const days = daysBetween(q.from, q.to);
  if (days < 0)
    throw errors.validation("The end date must be on or after the start date.", {
      fields: { to: "Must be on or after the start date." },
    });
  if (days >= MAX_SUGGESTION_DAYS)
    throw errors.validation(`Search at most ${MAX_SUGGESTION_DAYS} days at a time.`, {
      fields: { to: "Choose a shorter range." },
    });
  if (q.latestHour * 60 - q.earliestHour * 60 < q.durationMinutes) {
    throw errors.validation("The time window is shorter than the meeting. Widen the hours or shorten the meeting.", {
      fields: { latestHour: "Window is shorter than the meeting." },
    });
  }
}

export async function getSuggestions(
  teamId: string,
  actorId: string,
  viewerTimeZone: string,
  query: MeetingSuggestionsQuery,
  now: Date = new Date(),
): Promise<MeetingSuggestionDTO[]> {
  await requireMembership(teamId, actorId);
  validateSuggestionQuery(query);
  const availability = await getTeamAvailability(teamId);
  const rangeStart = zonedInstant(query.from, 0, viewerTimeZone);
  const rangeEnd = zonedInstant(addDays(query.to, 1), 0, viewerTimeZone);
  const busy = await db.meeting.findMany({
    where: { teamId, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
    select: { startsAt: true, endsAt: true },
  });
  return suggestMeetingTimes({
    members: availability.members.map((m) => ({ userId: m.user.id, timezone: m.timezone, slots: m.slots })),
    viewerTimeZone,
    from: query.from,
    to: query.to,
    durationMinutes: query.durationMinutes,
    earliestHour: query.earliestHour,
    latestHour: query.latestHour,
    busy,
    limit: query.limit,
    now,
  });
}

export interface WeekHeatmapDTO {
  weekStart: string;
  members: UserSummaryDTO[];
  /** 336 cells (day * 48 + halfHour, viewer's zone): ids of members free in that cell. */
  cells: string[][];
  /** Members who haven't painted any availability yet. */
  missing: UserSummaryDTO[];
}

/** Heatmap for the calendar week starting `weekStart` (a Monday in the viewer's zone). */
export async function getWeekHeatmap(
  teamId: string,
  actorId: string,
  weekStart: string,
  viewerTimeZone: string,
): Promise<WeekHeatmapDTO> {
  await requireMembership(teamId, actorId);
  const availability = await getTeamAvailability(teamId);
  const members = availability.members.map((m) => ({ userId: m.user.id, timezone: m.timezone, slots: m.slots }));
  return {
    weekStart,
    members: availability.members.map((m) => m.user),
    cells: weekAvailability(members, weekStart, viewerTimeZone),
    missing: availability.members.filter((m) => m.slots.length === 0).map((m) => m.user),
  };
}

/** Members, for "who hasn't answered" on the meeting page. */
export async function listTeamMembersForMeeting(
  teamId: string,
  actorId: string,
): Promise<{ members: UserSummaryDTO[]; myRole: Membership["role"] }> {
  const membership = await requireMembership(teamId, actorId);
  const rows = await db.teamMember.findMany({
    where: { teamId },
    select: { user: { select: userSummarySelect } },
    orderBy: { joinedAt: "asc" },
  });
  return { members: rows.map((r) => toUserSummary(r.user)), myRole: membership.role };
}

export function hasEnded(meeting: Pick<MeetingDTO, "endsAt">, now: Date = new Date()): boolean {
  return Date.parse(meeting.endsAt) < now.getTime();
}
