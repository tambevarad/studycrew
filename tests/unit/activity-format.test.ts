import { describe, expect, it } from "vitest";
import { activitySentence, ENTITY_LABELS, groupByDay } from "@/components/features/activity/format";
import { ENTITY_TYPES } from "@/contracts/activity";
import { decodeCursor, encodeCursor } from "@/server/services/activity/cursor";

const user = { id: "u1", name: "Krish Ruparel", email: "k@x.test", image: null };

describe("PB-09 activity formatting", () => {
  it("AC1: builds 'Name summary' sentences", () => {
    expect(activitySentence({ actor: user, summary: "moved “Slides” to Review" })).toBe("Krish Ruparel moved “Slides” to Review");
  });

  it("AC5: shows 'Someone' when the actor's account is gone", () => {
    expect(activitySentence({ actor: null, summary: "created the team" })).toBe("Someone created the team");
  });

  it("has a label for every entity type", () => {
    for (const t of ENTITY_TYPES) expect(ENTITY_LABELS[t]).toBeTruthy();
  });

  it("AC1: groups by day in the viewer's time zone, not UTC", () => {
    const now = new Date("2026-10-23T03:00:00Z"); // Oct 22, 10 pm in Chicago
    const items = [
      { id: "a", createdAt: "2026-10-23T02:30:00Z" }, // Oct 22, 9:30 pm Chicago → Today
      { id: "b", createdAt: "2026-10-22T05:30:00Z" }, // Oct 22, 0:30 am Chicago → Today
      { id: "c", createdAt: "2026-10-22T04:30:00Z" }, // Oct 21, 11:30 pm Chicago → Yesterday
      { id: "d", createdAt: "2026-10-19T15:00:00Z" }, // Mon Oct 19
      { id: "e", createdAt: "2025-12-31T15:00:00Z" }, // previous year → includes the year
    ];
    const groups = groupByDay(items, "America/Chicago", now);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id).join("")])).toEqual([
      ["Today", "ab"],
      ["Yesterday", "c"],
      ["Mon, Oct 19", "d"],
      ["Wed, Dec 31, 2025", "e"],
    ]);
    // Same instants in UTC split differently — proves the time zone is applied.
    expect(groupByDay(items.slice(0, 3), "UTC", now).map((g) => g.items.length)).toEqual([1, 2]);
  });

  it("round-trips cursors and rejects garbage", () => {
    const d = new Date("2026-10-22T12:00:00.123Z");
    expect(decodeCursor(encodeCursor(d, "abc"))).toEqual({ createdAt: d, id: "abc" });
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(Buffer.from("2026-99-99|x").toString("base64url"))).toBeNull();
  });
});
