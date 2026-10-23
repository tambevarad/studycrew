import type { ActivityDTO, EntityTypeValue } from "@/contracts/activity";

/** Labels for the category filter; order is the order shown in the UI. */
export const ENTITY_LABELS: Record<EntityTypeValue, string> = {
  task: "Tasks",
  meeting: "Meetings",
  resource: "Resources",
  coverage: "AI checks",
  milestone: "Milestones",
  poll: "Polls",
  member: "Members",
  team: "Team settings",
};

/** "Krish Ruparel moved “Slides” to Review"; "Someone …" when the actor's account is gone. */
export function activitySentence(item: Pick<ActivityDTO, "actor" | "summary">): string {
  return `${item.actor?.name ?? "Someone"} ${item.summary}`;
}

function dayKey(d: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares cleanly.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export interface ActivityDayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Groups newest-first items by calendar day in the viewer's time zone:
 * "Today", "Yesterday", then "Mon, Oct 19" (adds the year when it differs from now).
 */
export function groupByDay<T extends { createdAt: string }>(items: T[], timeZone: string, now: Date = new Date()): ActivityDayGroup<T>[] {
  const today = dayKey(now, timeZone);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000), timeZone);
  const groups: ActivityDayGroup<T>[] = [];
  for (const item of items) {
    const d = new Date(item.createdAt);
    const key = dayKey(d, timeZone);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label =
        key === today
          ? "Today"
          : key === yesterday
            ? "Yesterday"
            : new Intl.DateTimeFormat("en-US", {
                timeZone,
                weekday: "short",
                month: "short",
                day: "numeric",
                ...(key.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
              }).format(d);
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
