/**
 * PB-06 meeting finder — pure, deterministic, no I/O.
 *
 * Each member's weekly availability is stored in THEIR OWN time zone (contracts/availability.ts).
 * Candidates are generated in the VIEWER's time zone. For every 30-minute cell a candidate covers,
 * we convert the instant into the member's zone and check that member's weekday + half-hour slot.
 * Converting per instant (rather than shifting whole grids by a fixed offset) is what keeps results
 * correct across daylight-saving changes, e.g. US clocks on Sun Nov 1, 2026 and UK clocks on Oct 25.
 */
import { SLOTS_PER_DAY, SLOT_MINUTES } from "@/contracts/availability";
import type { MeetingSuggestionDTO } from "@/contracts/meetings";
import { addDays, daysBetween, zonedInstant, zonedParts } from "@/components/features/meetings/calendar-dates";

export interface FinderMember {
  userId: string;
  timezone: string;
  slots: number[];
}

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface SuggestArgs {
  members: FinderMember[];
  viewerTimeZone: string;
  /** Inclusive calendar dates in the viewer's zone. */
  from: string;
  to: string;
  durationMinutes: number;
  earliestHour: number;
  latestHour: number;
  busy: BusyInterval[];
  limit: number;
  /** Candidates must start after this instant. */
  now?: Date;
}

const CELL_MS = SLOT_MINUTES * 60_000;

/** Slot index (0–335) of the instant in the given zone. */
export function slotAt(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.weekday * SLOTS_PER_DAY + p.hours * 2 + (p.minutes >= 30 ? 1 : 0);
}

/** Pre-compiles members so the hot loop only does set lookups. */
function compile(members: FinderMember[]) {
  return members.map((m) => ({ userId: m.userId, timezone: m.timezone, slots: new Set(m.slots) }));
}

function freeDuring(member: ReturnType<typeof compile>[number], startMs: number, cells: number): boolean {
  if (member.slots.size === 0) return false;
  for (let k = 0; k < cells; k++) {
    if (!member.slots.has(slotAt(startMs + k * CELL_MS, member.timezone))) return false;
  }
  return true;
}

export function suggestMeetingTimes(args: SuggestArgs): MeetingSuggestionDTO[] {
  const { viewerTimeZone, durationMinutes, earliestHour, latestHour, limit } = args;
  const cells = Math.ceil(durationMinutes / SLOT_MINUTES);
  const firstMinute = earliestHour * 60;
  const lastStartMinute = latestHour * 60 - durationMinutes;
  const days = daysBetween(args.from, args.to);
  if (cells <= 0 || lastStartMinute < firstMinute || days < 0 || args.members.length === 0) return [];

  const members = compile(args.members);
  const busy = args.busy.map((b) => [b.startsAt.getTime(), b.endsAt.getTime()] as const);
  const nowMs = args.now?.getTime() ?? Number.NEGATIVE_INFINITY;
  const found: MeetingSuggestionDTO[] = [];

  for (let day = 0; day <= days; day++) {
    const date = addDays(args.from, day);
    for (let minute = firstMinute; minute <= lastStartMinute; minute += SLOT_MINUTES) {
      const start = zonedInstant(date, minute, viewerTimeZone).getTime();
      if (start <= nowMs) continue;
      const end = start + durationMinutes * 60_000;
      if (busy.some(([s, e]) => s < end && e > start)) continue;

      const available: string[] = [];
      const unavailable: string[] = [];
      for (const m of members) (freeDuring(m, start, cells) ? available : unavailable).push(m.userId);
      if (available.length === 0) continue;

      found.push({
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        availableCount: available.length,
        totalMembers: members.length,
        availableUserIds: available,
        unavailableUserIds: unavailable,
      });
    }
  }

  // Stable sort: most people free first, then earliest.
  found.sort((a, b) => b.availableCount - a.availableCount || a.startsAt.localeCompare(b.startsAt));
  // Drop candidates that start inside an already-chosen window with the same people, so the list
  // isn't "7:00, 7:30, 8:00…" for one long free block.
  const picked: MeetingSuggestionDTO[] = [];
  for (const s of found) {
    const overlapsPicked = picked.some(
      (p) =>
        p.availableCount === s.availableCount &&
        Date.parse(p.startsAt) < Date.parse(s.endsAt) &&
        Date.parse(s.startsAt) < Date.parse(p.endsAt),
    );
    if (!overlapsPicked) picked.push(s);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * For the week starting `weekStart` (a Monday, viewer's zone): which members are free in each of the
 * 336 viewer-zone half-hour cells. Index = day * 48 + halfHour.
 */
export function weekAvailability(members: FinderMember[], weekStart: string, viewerTimeZone: string): string[][] {
  const compiled = compile(members);
  const out: string[][] = [];
  for (let day = 0; day < 7; day++) {
    const date = addDays(weekStart, day);
    for (let half = 0; half < SLOTS_PER_DAY; half++) {
      const at = zonedInstant(date, half * SLOT_MINUTES, viewerTimeZone).getTime();
      out.push(compiled.filter((m) => m.slots.has(slotAt(at, m.timezone))).map((m) => m.userId));
    }
  }
  return out;
}

/** Counts only (the contract's `weekHeatmap`). */
export function weekHeatmap(members: FinderMember[], weekStart: string, viewerTimeZone: string): number[] {
  return weekAvailability(members, weekStart, viewerTimeZone).map((ids) => ids.length);
}
