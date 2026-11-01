import { describe, expect, it } from "vitest";
import { byDueSoonest, isDueSoonAt, isOverdueAt, workloadByMember } from "@/server/services/dashboard/rules";

const NOW = new Date("2026-11-04T15:00:00Z");
const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const user = (id: string, name = id) => ({ id, name, email: `${id}@t.local`, image: null });

describe("PB-12 due rules", () => {
  it("AC2: overdue is due before now and not Done", () => {
    expect(isOverdueAt({ status: "TODO", dueAt: at(-1) }, NOW)).toBe(true);
    expect(isOverdueAt({ status: "DONE", dueAt: at(-1) }, NOW)).toBe(false);
    expect(isOverdueAt({ status: "TODO", dueAt: at(0) }, NOW)).toBe(false);
    expect(isOverdueAt({ status: "TODO", dueAt: null }, NOW)).toBe(false);
  });

  it("due soon is [now, now + 24 h] and not Done", () => {
    expect(isDueSoonAt({ status: "REVIEW", dueAt: at(0) }, NOW)).toBe(true);
    expect(isDueSoonAt({ status: "REVIEW", dueAt: at(24) }, NOW)).toBe(true);
    expect(isDueSoonAt({ status: "REVIEW", dueAt: at(24.01) }, NOW)).toBe(false);
    expect(isDueSoonAt({ status: "DONE", dueAt: at(1) }, NOW)).toBe(false);
    expect(isDueSoonAt({ status: "TODO", dueAt: at(-1) }, NOW)).toBe(false);
  });

  it("sorts soonest due first, undated last, ties by creation", () => {
    const tasks = [
      { id: "nodate", dueAt: null, createdAt: "2026-11-01T00:00:00Z" },
      { id: "late", dueAt: at(5), createdAt: "2026-11-01T00:00:00Z" },
      { id: "early-b", dueAt: at(1), createdAt: "2026-11-02T00:00:00Z" },
      { id: "early-a", dueAt: at(1), createdAt: "2026-11-01T00:00:00Z" },
    ];
    expect([...tasks].sort(byDueSoonest).map((t) => t.id)).toEqual(["early-a", "early-b", "late", "nodate"]);
  });
});

describe("PB-12 workloadByMember", () => {
  it("AC3: counts open and overdue per member, keeps members with 0, ignores Done and ex-members, sorts by name", () => {
    const members = [user("z", "Zoe"), user("a", "Ana")];
    const rows = workloadByMember(
      members,
      [
        { status: "TODO", dueAt: at(-2), assignees: [user("a"), user("z")] },
        { status: "IN_PROGRESS", dueAt: null, assignees: [user("a")] },
        { status: "DONE", dueAt: at(-2), assignees: [user("z")] },
        { status: "TODO", dueAt: null, assignees: [user("gone")] },
      ],
      NOW,
    );
    expect(rows.map((r) => [r.user.name, r.open, r.overdue])).toEqual([
      ["Ana", 2, 1],
      ["Zoe", 1, 1],
    ]);
    expect(workloadByMember(members, [], NOW).map((r) => r.open)).toEqual([0, 0]);
  });
});
