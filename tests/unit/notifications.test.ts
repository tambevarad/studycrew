import { describe, expect, it } from "vitest";
import { badgeText, bellLabel, groupByAge } from "@/components/features/notifications/notification-utils";
import type { NotificationDTO } from "@/contracts/notifications";

const n = (id: string, createdAt: string): NotificationDTO => ({
  id,
  type: "TASK_ASSIGNED",
  teamId: null,
  title: id,
  body: null,
  link: null,
  readAt: null,
  createdAt,
});

describe("PB-08 bell", () => {
  it("AC3/AC7: badge caps at 9+ and the count is in the accessible name", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(3)).toBe("3");
    expect(badgeText(10)).toBe("9+");
    expect(bellLabel(3)).toBe("Notifications, 3 unread");
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(null)).toBe("Notifications");
  });
});

describe("PB-08 grouping", () => {
  it("groups by the viewer's calendar day: Today, This week, Earlier", () => {
    const now = new Date("2026-10-28T15:00:00Z"); // 10:00 AM in Chicago
    const items = [
      n("today", "2026-10-28T06:00:00Z"), // 1:00 AM Chicago, same day
      n("yesterday-late", "2026-10-28T04:30:00Z"), // 11:30 PM Oct 27 in Chicago
      n("week", "2026-10-23T12:00:00Z"),
      n("old", "2026-10-10T12:00:00Z"),
    ];
    const groups = groupByAge(items, now, "America/Chicago");
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Today", ["today"]],
      ["This week", ["yesterday-late", "week"]],
      ["Earlier", ["old"]],
    ]);
    // In UTC the late one is still "today".
    expect(groupByAge(items, now, "UTC")[0].items.map((i) => i.id)).toEqual(["today", "yesterday-late"]);
    expect(groupByAge([], now, "UTC")).toEqual([]);
  });
});
