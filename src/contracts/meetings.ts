/** PB-06 · FR-03 — Shared calendar, meeting finder, RSVPs. PB-15 agenda types live in agenda.ts. */
import { z } from "zod";
import { isoDate, isoDateTime, type UserSummaryDTO } from "./common";

export const RSVP_RESPONSES = ["YES", "NO", "MAYBE"] as const;
export type RsvpValue = (typeof RSVP_RESPONSES)[number];
export const MAX_MEETING_MINUTES = 8 * 60;

const meetingFields = z.object({
  title: z.string().trim().min(1, "Give the meeting a title.").max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(300).optional(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
});

function validRange(v: { startsAt?: string; endsAt?: string }) {
  if (!v.startsAt || !v.endsAt) return true;
  const ms = Date.parse(v.endsAt) - Date.parse(v.startsAt);
  return ms > 0 && ms <= MAX_MEETING_MINUTES * 60_000;
}
const rangeMessage = { message: "End time must be after the start and within 8 hours.", path: ["endsAt"] };

export const createMeetingInput = meetingFields.refine(validRange, rangeMessage);
export type CreateMeetingInput = z.infer<typeof createMeetingInput>;

export const updateMeetingInput = meetingFields.partial().refine(validRange, rangeMessage);
export type UpdateMeetingInput = z.infer<typeof updateMeetingInput>;

export const rsvpInput = z.object({ response: z.enum(RSVP_RESPONSES) });
export type RsvpInput = z.infer<typeof rsvpInput>;

export const listMeetingsQuery = z.object({ from: isoDateTime, to: isoDateTime });
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuery>;

/**
 * Meeting finder. `from`/`to` are calendar dates in the viewer's timezone (inclusive).
 * Candidate windows are aligned to 30-minute boundaries between earliestHour and latestHour
 * (viewer's local time), ranked by availableCount desc, then earliest start.
 */
export const meetingSuggestionsQuery = z.object({
  from: isoDate,
  to: isoDate,
  durationMinutes: z.coerce.number().int().min(30).max(240).multipleOf(30).default(60),
  earliestHour: z.coerce.number().int().min(0).max(23).default(8),
  latestHour: z.coerce.number().int().min(1).max(24).default(22),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export type MeetingSuggestionsQuery = z.infer<typeof meetingSuggestionsQuery>;

export interface MeetingDTO {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  createdBy: UserSummaryDTO;
  rsvps: Array<{ user: UserSummaryDTO; response: RsvpValue }>;
  myRsvp: RsvpValue | null;
}

export interface MeetingSuggestionDTO {
  startsAt: string;
  endsAt: string;
  availableCount: number;
  totalMembers: number;
  availableUserIds: string[];
  unavailableUserIds: string[];
}
