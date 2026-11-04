/**
 * Pure helpers for the PB-14 polls screens (unit-tested in tests/unit/polls.test.ts).
 * No Intl formatting here: the countdown is plain arithmetic, so the server's and the browser's first render match.
 */
import { TZDate } from "@date-fns/tz";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "Closes in 2 d 5 h", "Closes in 3 h 10 min", "Closes in 4 min", "Closing now". */
export function closesInLabel(closesAtIso: string, now: Date): string {
  const ms = new Date(closesAtIso).getTime() - now.getTime();
  if (ms < MIN) return "Closing now";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  if (d > 0) return `Closes in ${d} d${h ? ` ${h} h` : ""}`;
  if (h > 0) return `Closes in ${h} h${m ? ` ${m} min` : ""}`;
  return `Closes in ${m} min`;
}

/** Value for a `datetime-local` input: `days` from now at `hour`:00 in the viewer's zone, e.g. "2026-11-05T21:00". */
export function defaultCloseInputValue(now: Date, timeZone: string, days = 2, hour = 21): string {
  const local = new TZDate(now.getTime(), timeZone);
  const target = new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + days, hour, 0, 0, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

/** `datetime-local` value in the viewer's zone → UTC ISO string for the API, or null if it isn't a full date and time. */
export function closeInputToIso(value: string, timeZone: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // TZDate#toISOString keeps the zone offset; go through Date so the DTO gets UTC ("…Z") like every other date.
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, timeZone).getTime()).toISOString();
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

/** Percent of all votes, rounded, for bars and the "(67%)" text. 0 when nobody voted. */
export function percent(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100);
}
