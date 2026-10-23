import { describe, expect, it } from "vitest";
import {
  columnOf,
  dueDisplay,
  filterTasks,
  fromDueInputValue,
  moveLocally,
  toDueInputValue,
} from "@/components/features/tasks/board-utils";
import type { TaskDTO } from "@/contracts/tasks";

const user = (id: string) => ({ id, name: id, email: `${id}@t.local`, image: null });
const task = (over: Partial<TaskDTO>): TaskDTO => ({
  id: "t",
  teamId: "team",
  title: "Task",
  description: null,
  status: "TODO",
  priority: "MEDIUM",
  dueAt: null,
  position: 1000,
  milestoneId: null,
  assignees: [],
  createdBy: user("u1"),
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  completedAt: null,
  isOverdue: false,
  coverageItemId: null,
  ...over,
});

const NOW = new Date("2026-10-22T15:00:00Z");
const TZ = "America/Chicago";

describe("PB-05 due labels", () => {
  it("AC7: overdue is danger with “Overdue”, due within 24 h is warning", () => {
    expect(dueDisplay(task({ dueAt: "2026-10-20T15:00:00Z" }), NOW, TZ)).toEqual({
      label: "Overdue by 2 d",
      tone: "danger",
    });
    expect(dueDisplay(task({ dueAt: "2026-10-22T20:00:00Z" }), NOW, TZ)).toEqual({
      label: "Due in 5 h",
      tone: "warning",
    });
    expect(dueDisplay(task({ dueAt: "2026-10-30T15:00:00Z" }), NOW, TZ)?.tone).toBe("neutral");
  });

  it("done tasks and tasks without a due date are never red", () => {
    expect(dueDisplay(task({ dueAt: "2026-10-20T15:00:00Z", status: "DONE" }), NOW, TZ)).toEqual({
      label: "Due Oct 20, 2026",
      tone: "neutral",
    });
    expect(dueDisplay(task({}), NOW, TZ)).toBeNull();
  });
});

describe("PB-05 due date input (viewer's time zone)", () => {
  it("round-trips wall time in the viewer's zone, including after the DST change", () => {
    expect(fromDueInputValue("2026-10-28T17:00", TZ)).toBe("2026-10-28T22:00:00.000Z"); // CDT, UTC−5
    expect(fromDueInputValue("2026-11-02T17:00", TZ)).toBe("2026-11-02T23:00:00.000Z"); // CST, UTC−6
    expect(toDueInputValue("2026-10-28T22:00:00.000Z", TZ)).toBe("2026-10-28T17:00");
    expect(toDueInputValue("2026-10-28T22:00:00.000Z", "Asia/Kolkata")).toBe("2026-10-29T03:30");
  });

  it("empty values mean no due date", () => {
    expect(fromDueInputValue("", TZ)).toBeNull();
    expect(toDueInputValue(null, TZ)).toBe("");
  });
});

describe("PB-05 optimistic moves and filters", () => {
  const tasks = [
    task({ id: "a", position: 1000 }),
    task({ id: "b", position: 2000 }),
    task({ id: "c", position: 3000 }),
    task({ id: "r", status: "REVIEW", position: 1000 }),
  ];

  it("moves within and across columns like the server", () => {
    expect(columnOf(moveLocally(tasks, "c", "TODO", 0), "TODO").map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(columnOf(moveLocally(tasks, "a", "TODO", 1), "TODO").map((t) => t.id)).toEqual(["b", "a", "c"]);
    const moved = moveLocally(tasks, "a", "REVIEW", 5);
    expect(columnOf(moved, "REVIEW").map((t) => t.id)).toEqual(["r", "a"]);
    expect(columnOf(moveLocally(tasks, "r", "DONE", 0), "DONE")[0].position).toBe(1000);
    expect(moveLocally(tasks, "missing", "DONE", 0)).toEqual(tasks);
  });

  it("filters by assignee, priority, and text", () => {
    const list = [
      task({ id: "1", title: "Slides", assignees: [user("me")], priority: "HIGH" }),
      task({ id: "2", title: "Report", description: "slides appendix", priority: "LOW" }),
      task({ id: "3", title: "Budget" }),
    ];
    const ids = (f: Parameters<typeof filterTasks>[1]) => filterTasks(list, f, "me").map((t) => t.id);
    expect(ids({ mine: true, priority: "ALL", q: "" })).toEqual(["1"]);
    expect(ids({ mine: false, priority: "LOW", q: "" })).toEqual(["2"]);
    expect(ids({ mine: false, priority: "ALL", q: "SLIDES" })).toEqual(["1", "2"]);
  });
});
