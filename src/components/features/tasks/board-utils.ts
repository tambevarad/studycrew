/**
 * Pure board helpers for the client (PB-05). The server decides real positions; these only drive the optimistic
 * view, labels, filters, and the due-date input.
 */
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TASK_STATUSES, type TaskDTO, type TaskPriorityValue, type TaskStatusValue } from "@/contracts/tasks";
import { dueLabel, formatDate } from "@/lib/dates";

export const PRIORITY_LABELS: Record<TaskPriorityValue, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export const PRIORITY_TONES = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" } as const satisfies Record<
  TaskPriorityValue,
  "danger" | "warning" | "neutral"
>;

const DAY_MS = 24 * 3_600_000;

/** Due text and colour: overdue → danger ("Overdue by …"), due within 24 h → warning, done or later → neutral. */
export function dueDisplay(
  task: Pick<TaskDTO, "dueAt" | "status">,
  now: Date,
  timeZone: string,
): { label: string; tone: "danger" | "warning" | "neutral" } | null {
  if (!task.dueAt) return null;
  if (task.status === "DONE") return { label: `Due ${formatDate(task.dueAt, timeZone)}`, tone: "neutral" };
  const ms = new Date(task.dueAt).getTime() - now.getTime();
  const label = dueLabel(task.dueAt, now, timeZone);
  if (ms < 0) return { label, tone: "danger" };
  if (ms <= DAY_MS) return { label, tone: "warning" };
  return { label, tone: "neutral" };
}

/** ISO → value for `<input type="datetime-local">` in the viewer's zone ("2026-10-28T17:00"). */
export function toDueInputValue(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return format(new TZDate(iso, timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** `<input type="datetime-local">` value, read as wall time in the viewer's zone → ISO (UTC). Empty → null. */
export function fromDueInputValue(value: string, timeZone: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // TZDate#toISOString keeps the zone's offset; go through Date for UTC ("…Z") like every other DTO date.
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, timeZone).getTime()).toISOString();
}

/** One column's tasks, top to bottom. */
export function columnOf(tasks: readonly TaskDTO[], status: TaskStatusValue): TaskDTO[] {
  return tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);
}

/**
 * Optimistic move: same rule as the server (midpoint of the new neighbours, ±1000 at the ends), without rebalancing.
 * `index` counts cards in the target column excluding the moved one.
 */
export function moveLocally(
  tasks: readonly TaskDTO[],
  taskId: string,
  status: TaskStatusValue,
  index: number,
): TaskDTO[] {
  const moving = tasks.find((t) => t.id === taskId);
  if (!moving) return [...tasks];
  const others = columnOf(tasks, status).filter((t) => t.id !== taskId);
  const i = Math.max(0, Math.min(index, others.length));
  let position: number;
  if (others.length === 0) position = 1000;
  else if (i === 0) position = others[0].position - 1000;
  else if (i === others.length) position = others[others.length - 1].position + 1000;
  else position = (others[i - 1].position + others[i].position) / 2;
  return tasks.map((t) => (t.id === taskId ? { ...t, status, position } : t));
}

export interface BoardFilters {
  mine: boolean;
  priority: TaskPriorityValue | "ALL";
  q: string;
}

export function filterTasks(tasks: readonly TaskDTO[], f: BoardFilters, meId: string): TaskDTO[] {
  const q = f.q.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!f.mine || t.assignees.some((a) => a.id === meId)) &&
      (f.priority === "ALL" || t.priority === f.priority) &&
      (!q || t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)),
  );
}

export const COLUMN_ORDER: readonly TaskStatusValue[] = TASK_STATUSES;
