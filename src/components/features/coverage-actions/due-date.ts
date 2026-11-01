import { TZDate } from "@date-fns/tz";

/**
 * A date-only pick ("2026-11-05") means "by the end of that day" in the viewer's own time zone.
 * Returns a UTC ISO string ("…Z") like every other DTO date; empty input → null.
 */
export function endOfDayIso(date: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  // TZDate#toISOString keeps the zone's offset; go through Date for "…Z".
  return new Date(new TZDate(Number(y), Number(mo) - 1, Number(d), 23, 59, 0, timeZone).getTime()).toISOString();
}

export function boardTaskLink(teamId: string, taskId: string): string {
  return `/teams/${teamId}/board?task=${taskId}`;
}
