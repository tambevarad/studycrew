/**
 * PB-13 pure rules, shared by the service and the template preview (unit-tested).
 */
import { addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

const DAY_MS = 86_400_000;

/** round(done / total × 100); 0 when there are no tasks. */
export function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/**
 * `count` due dates spread evenly after `from`, the last one exactly `to` (AC1). When there is at least a day per
 * milestone, each one is a whole number of days before `to` at the same wall-clock time in `timeZone` (DST-safe);
 * otherwise they are spread evenly to the minute.
 */
export function spreadDueDates(count: number, from: Date, to: Date, timeZone: string): Date[] {
  if (count <= 0) return [];
  const span = to.getTime() - from.getTime();
  const daysBefore = (i: number) => ((count - 1 - i) * span) / count / DAY_MS;
  if (span >= count * DAY_MS) {
    const final = new TZDate(to.getTime(), timeZone);
    return Array.from({ length: count }, (_, i) => new Date(addDays(final, -Math.round(daysBefore(i))).getTime()));
  }
  return Array.from({ length: count }, (_, i) => new Date(Math.round(to.getTime() - daysBefore(i) * DAY_MS)));
}

/** A date-only pick ("2026-11-20") means 11:59 pm that day in the viewer's zone, as a UTC ISO string; else null. */
export function endOfDayIso(date: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  return new Date(
    new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0, timeZone).getTime(),
  ).toISOString();
}

/** The "YYYY-MM-DD" a stored due date falls on in the viewer's zone (to prefill a date input). */
export function dateInputValue(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const z = new TZDate(new Date(iso).getTime(), timeZone);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}
