/**
 * Date formatting helpers. Always pass the viewer's IANA timezone (SessionUser.timezone)
 * so times render in the user's zone, not the server's.
 */
export const DEFAULT_TZ = "America/Chicago";

export function formatDateTime(iso: string, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", else a date. */
export function relativeTime(iso: string, now: Date = new Date(), timeZone = DEFAULT_TZ): string {
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86_400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 7 * 86_400) return `${Math.round(diff / 86_400)} d ago`;
  return formatDate(iso, timeZone);
}

/** Text for a due date relative to now: "Overdue by 2 d", "Due in 5 h", "Due Oct 30". */
export function dueLabel(iso: string, now: Date = new Date(), timeZone = DEFAULT_TZ): string {
  const ms = new Date(iso).getTime() - now.getTime();
  const hours = Math.round(Math.abs(ms) / 3_600_000);
  if (ms < 0) return hours < 24 ? `Overdue by ${Math.max(hours, 1)} h` : `Overdue by ${Math.round(hours / 24)} d`;
  if (hours < 24) return `Due in ${Math.max(hours, 1)} h`;
  return `Due ${formatDate(iso, timeZone)}`;
}
