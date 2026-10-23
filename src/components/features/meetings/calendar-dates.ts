/**
 * Calendar-date helpers on "YYYY-MM-DD" strings (no time, no zone) plus zone-aware conversions.
 * Pure and client-safe; shared by the meeting finder (server) and the week view (client).
 */
import { TZDate } from "@date-fns/tz";

export function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Adds whole calendar days (UTC arithmetic on the date only, so DST never shifts it). */
export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return formatDateKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday for a calendar date. */
export function weekdayOf(date: string): number {
  const { y, m, d } = parseDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/** Today's calendar date in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const z = new TZDate(now.getTime(), timeZone);
  return formatDateKey(z.getFullYear(), z.getMonth() + 1, z.getDate());
}

/** The instant at local wall-clock `date` + `minutes` after midnight in `timeZone`. */
export function zonedInstant(date: string, minutes: number, timeZone: string): Date {
  const { y, m, d } = parseDate(date);
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, timeZone).getTime());
}

/** Wall-clock parts of an instant in a time zone. weekday: 0 = Monday. */
export function zonedParts(instant: Date | number, timeZone: string) {
  const z = new TZDate(typeof instant === "number" ? instant : instant.getTime(), timeZone);
  return {
    date: formatDateKey(z.getFullYear(), z.getMonth() + 1, z.getDate()),
    weekday: (z.getDay() + 6) % 7,
    hours: z.getHours(),
    minutes: z.getMinutes(),
  };
}

export function isValidDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
