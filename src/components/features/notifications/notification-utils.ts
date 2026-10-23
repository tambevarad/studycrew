/** Pure helpers for the notification bell and page (PB-08). */
import type { NotificationDTO } from "@/contracts/notifications";

/** Window event the page fires after marking read, so the sidebar bell refreshes right away. */
export const NOTIFICATIONS_CHANGED = "studycrew:notifications-changed";

/** Badge text: 0 → nothing, 1–9 → the number, more → "9+". */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/** Screen-reader name for the bell link (AC7). */
export function bellLabel(count: number | null): string {
  if (!count) return "Notifications";
  return `Notifications, ${count} unread`;
}

/** Calendar date "YYYY-MM-DD" of an instant in a time zone. */
function dayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type GroupLabel = "Today" | "This week" | "Earlier";

/** "Today" (same calendar day in the viewer's zone), "This week" (last 7 days), else "Earlier". Keeps order. */
export function groupByAge(
  items: readonly NotificationDTO[],
  now: Date,
  timeZone: string,
): { label: GroupLabel; items: NotificationDTO[] }[] {
  const today = dayKey(now, timeZone);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const groups: { label: GroupLabel; items: NotificationDTO[] }[] = [];
  for (const n of items) {
    const at = new Date(n.createdAt);
    const label: GroupLabel =
      dayKey(at, timeZone) === today ? "Today" : at.getTime() >= weekAgo ? "This week" : "Earlier";
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}
