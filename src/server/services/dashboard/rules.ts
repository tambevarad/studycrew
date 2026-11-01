/** PB-12 pure rules for the dashboards (unit-tested). They work on contract DTOs only. */
import type { UserSummaryDTO } from "@/contracts/common";
import { DUE_SOON_HOURS } from "@/contracts/notifications";
import type { TaskDTO } from "@/contracts/tasks";

const HOUR_MS = 3_600_000;

type DueTask = Pick<TaskDTO, "status" | "dueAt">;

const dueMs = (t: Pick<TaskDTO, "dueAt">) => (t.dueAt ? Date.parse(t.dueAt) : Number.NaN);

/** AC2: due before `now` and not Done. */
export function isOverdueAt(task: DueTask, now: Date): boolean {
  return task.status !== "DONE" && dueMs(task) < now.getTime();
}

/** Not Done and due in [now, now + 24 h] (the same 24 h window as the due-soon reminders). */
export function isDueSoonAt(task: DueTask, now: Date): boolean {
  const ms = dueMs(task);
  return task.status !== "DONE" && ms >= now.getTime() && ms <= now.getTime() + DUE_SOON_HOURS * HOUR_MS;
}

/** Soonest due first; tasks without a due date last; ties by creation time (stable for the UI). */
export function byDueSoonest<T extends Pick<TaskDTO, "dueAt" | "createdAt">>(a: T, b: T): number {
  const da = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
  const db = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
  return da - db || a.createdAt.localeCompare(b.createdAt);
}

/**
 * AC3: every member with their open (not Done) and overdue task counts, including members with 0, by name.
 * A task with several assignees counts once for each of them.
 */
export function workloadByMember(
  members: readonly UserSummaryDTO[],
  tasks: readonly Pick<TaskDTO, "status" | "dueAt" | "assignees">[],
  now: Date,
): Array<{ user: UserSummaryDTO; open: number; overdue: number }> {
  const counts = new Map(members.map((m) => [m.id, { user: m, open: 0, overdue: 0 }]));
  for (const t of tasks) {
    if (t.status === "DONE") continue;
    const overdue = isOverdueAt(t, now);
    for (const a of t.assignees) {
      const row = counts.get(a.id);
      if (!row) continue; // assigned to someone who has since left the team
      row.open += 1;
      if (overdue) row.overdue += 1;
    }
  }
  return [...counts.values()].sort((a, b) => a.user.name.localeCompare(b.user.name));
}
