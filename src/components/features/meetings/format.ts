/**
 * Date/time text for meetings, built from Intl *parts* with fixed separators.
 *
 * Why: these strings render on the server (Node's ICU) and again in the browser (Chrome's ICU).
 * Whole-string Intl output — especially formatRange and the space before AM/PM (U+202F vs U+0020) —
 * differs between ICU versions, which caused React hydration error #418 in CI. Parts are stable.
 */
type Parts = Record<string, string>;

function parts(d: Date, timeZone: string, opts: Intl.DateTimeFormatOptions): Parts {
  const out: Parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).formatToParts(d)) out[p.type] = p.value;
  return out;
}

function clock(d: Date, timeZone: string) {
  const p = parts(d, timeZone, { hour: "numeric", minute: "2-digit", hour12: true });
  return { hm: `${p.hour}:${p.minute}`, period: (p.dayPeriod ?? "").toUpperCase() };
}

/** "7:00 PM" */
export function formatClock(d: Date, timeZone: string): string {
  const c = clock(d, timeZone);
  return `${c.hm} ${c.period}`;
}

/** "6:30 – 7:30 PM", or "11:00 AM – 12:30 PM" when the period changes. */
export function formatTimeRange(start: Date, end: Date, timeZone: string): string {
  const a = clock(start, timeZone);
  const b = clock(end, timeZone);
  return a.period === b.period ? `${a.hm} – ${b.hm} ${b.period}` : `${a.hm} ${a.period} – ${b.hm} ${b.period}`;
}

/** "CDT", "EST", or "GMT+1" for zones without a common abbreviation. */
export function zoneAbbreviation(d: Date, timeZone: string): string {
  return (parts(d, timeZone, { timeZoneName: "short" }).timeZoneName ?? timeZone).replace(/[   ]/g, " ");
}

/** "Thu, Oct 29" */
export function formatDayShort(d: Date, timeZone: string): string {
  const p = parts(d, timeZone, { weekday: "short", month: "short", day: "numeric" });
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** "Thursday, October 29" (+ ", 2026" with withYear) */
export function formatDayLong(d: Date, timeZone: string, withYear = false): string {
  const p = parts(d, timeZone, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return `${p.weekday}, ${p.month} ${p.day}${withYear ? `, ${p.year}` : ""}`;
}

/** "Thu, Oct 29, 7:00 PM CDT" — for notifications, which are plain text. */
export function formatWhen(d: Date, timeZone: string): string {
  return `${formatDayShort(d, timeZone)}, ${formatClock(d, timeZone)} ${zoneAbbreviation(d, timeZone)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthShort(month1to12: number): string {
  return MONTHS[month1to12 - 1];
}
