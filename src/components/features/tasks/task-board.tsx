"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import type { UserSummaryDTO } from "@/contracts/common";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  type TaskDTO,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/contracts/tasks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";
import { COLUMN_ORDER, columnOf, filterTasks, moveLocally, PRIORITY_LABELS, type BoardFilters } from "./board-utils";
import type { MoveTarget } from "./move-menu";
import { TaskCard, TaskCardBody } from "./task-card";
import { TaskDialog } from "./task-dialog";

const COLUMN_PREFIX = "column:";

function Column({ status, count, children }: { status: TaskStatusValue; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });
  const headingId = `column-${status}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn("flex min-h-48 flex-col gap-3 rounded-lg bg-slate-50 p-3", isOver && "ring-brand-300 ring-2")}
    >
      <h3 id={headingId} className="flex items-center justify-between text-sm font-semibold text-slate-800">
        {TASK_STATUS_LABELS[status]}
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
          {count}
          <span className="sr-only"> {count === 1 ? "task" : "tasks"}</span>
        </span>
      </h3>
      {children}
    </section>
  );
}

export function TaskBoard({
  teamId,
  initialTasks,
  members,
  milestones,
  meId,
  timeZone,
  nowIso,
  initialTaskId,
}: {
  teamId: string;
  initialTasks: TaskDTO[];
  members: UserSummaryDTO[];
  milestones: { id: string; title: string }[];
  meId: string;
  timeZone: string;
  /** Server time, so due labels render the same on the server and in the browser. */
  nowIso: string;
  /** From `?task=<id>`: open that task's dialog (notification links). */
  initialTaskId: string | null;
}) {
  // Local copy for optimistic moves; reset whenever the server sends a fresh list (router.refresh()).
  const [tasks, setTasks] = useState(initialTasks);
  const [synced, setSynced] = useState(initialTasks);
  if (synced !== initialTasks) {
    setSynced(initialTasks);
    setTasks(initialTasks);
  }
  const [filters, setFilters] = useState<BoardFilters>({ mine: false, priority: "ALL", q: "" });
  const [dialog, setDialog] = useState<{ taskId: string | null } | null>(() =>
    initialTaskId && initialTasks.some((t) => t.id === initialTaskId) ? { taskId: initialTaskId } : null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const { run } = useApiAction();
  const now = new Date(nowIso);
  const visible = filterTasks(tasks, filters, meId);
  const filtered = filters.mine || filters.priority !== "ALL" || filters.q.trim() !== "";
  const titleOf = (id: string | number) => tasks.find((t) => t.id === id)?.title ?? "task";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function where(overId: string | number): { status: TaskStatusValue; overTaskId: string | null } | null {
    const id = String(overId);
    if (id.startsWith(COLUMN_PREFIX))
      return { status: id.slice(COLUMN_PREFIX.length) as TaskStatusValue, overTaskId: null };
    const over = tasks.find((t) => t.id === id);
    return over ? { status: over.status, overTaskId: over.id } : null;
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up “${titleOf(active.id)}”.`,
    onDragOver: ({ active, over }) => {
      const w = over ? where(over.id) : null;
      if (!w) return `“${titleOf(active.id)}” is no longer over a column.`;
      return w.overTaskId && w.overTaskId !== active.id
        ? `“${titleOf(active.id)}” is over “${titleOf(w.overTaskId)}” in ${TASK_STATUS_LABELS[w.status]}.`
        : `“${titleOf(active.id)}” is over ${TASK_STATUS_LABELS[w.status]}.`;
    },
    onDragEnd: ({ active, over }) => {
      const w = over ? where(over.id) : null;
      return w
        ? `Dropped “${titleOf(active.id)}” in ${TASK_STATUS_LABELS[w.status]}.`
        : `Dropped “${titleOf(active.id)}”. It did not move.`;
    },
    onDragCancel: ({ active }) => `Stopped dragging “${titleOf(active.id)}”. It did not move.`,
  };

  /** Optimistic move, then persist; on failure restore the previous board (the hook shows the error toast). */
  async function move(taskId: string, status: TaskStatusValue, index: number) {
    const before = tasks;
    setTasks(moveLocally(tasks, taskId, status, index));
    const saved = await run(
      () =>
        apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/tasks/${taskId}/move`, { method: "POST", body: { status, index } }),
      { refresh: false },
    );
    if (saved) setTasks((current) => current.map((t) => (t.id === saved.id ? saved : t)));
    else setTasks(before);
  }

  function onMenuMove(task: TaskDTO, target: MoveTarget) {
    const others = columnOf(tasks, target.status).filter((t) => t.id !== task.id);
    void move(task.id, target.status, target.place === "top" ? 0 : others.length);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const task = tasks.find((t) => t.id === taskId);
    const w = where(e.over.id);
    if (!task || !w) return;
    const target = columnOf(tasks, w.status);
    let index: number;
    if (!w.overTaskId) index = target.filter((t) => t.id !== taskId).length;
    else if (w.overTaskId === taskId) return;
    else index = target.findIndex((t) => t.id === w.overTaskId);
    // Same column: sortable semantics (the card ends up at the hovered card's index).
    if (task.status === w.status && target.findIndex((t) => t.id === taskId) === index) return;
    void move(taskId, w.status, index);
  }

  function closeDialog() {
    setDialog(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("task")) {
      url.searchParams.delete("task");
      window.history.replaceState(null, "", url);
    }
  }

  const active = activeId ? tasks.find((t) => t.id === activeId) : null;
  const dialogTask = dialog?.taskId ? (tasks.find((t) => t.id === dialog.taskId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Task board"
        description="Drag cards between columns, or use “Move to…” on any card."
        actions={
          <Button onClick={() => setDialog({ taskId: null })}>
            <Plus aria-hidden />
            New task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="Create your first task"
          description="Tasks are how your team splits up the work. Give each one an owner and a due date."
          action={<Button onClick={() => setDialog({ taskId: null })}>New task</Button>}
        />
      ) : (
        <>
          <div role="search" aria-label="Filter tasks" className="flex flex-wrap items-end gap-3">
            <div className="flex rounded-md border border-slate-300 p-0.5" role="group" aria-label="Whose tasks">
              {[
                { label: "All", mine: false },
                { label: "Assigned to me", mine: true },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={filters.mine === o.mine}
                  onClick={() => setFilters((f) => ({ ...f, mine: o.mine }))}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium",
                    filters.mine === o.mine ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
              Priority
              <Select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as TaskPriorityValue | "ALL" }))}
                className="w-36"
              >
                <option value="ALL">Any priority</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
              Search
              <span className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Title or description"
                  className="w-60 pl-9"
                />
              </span>
            </label>
            {filtered ? (
              <p className="pb-2 text-sm text-slate-600" aria-live="polite">
                Showing {visible.length} of {tasks.length} tasks.
              </p>
            ) : null}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            accessibility={{ announcements }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {COLUMN_ORDER.map((status) => {
                const column = columnOf(visible, status);
                return (
                  <Column key={status} status={status} count={column.length}>
                    <SortableContext items={column.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {column.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-500">Nothing here yet</p>
                      ) : (
                        <ul className="flex flex-col gap-2" aria-label={`${TASK_STATUS_LABELS[status]} tasks`}>
                          {column.map((t) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              now={now}
                              timeZone={timeZone}
                              onOpen={() => setDialog({ taskId: t.id })}
                              onMove={(target) => onMenuMove(t, target)}
                            />
                          ))}
                        </ul>
                      )}
                    </SortableContext>
                  </Column>
                );
              })}
            </div>
            <DragOverlay>
              {active ? (
                <div className="bg-surface border-brand-500 rounded-md border p-3 shadow-lg">
                  <TaskCardBody task={active} now={now} timeZone={timeZone} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {dialog ? (
        <TaskDialog
          key={dialog.taskId ?? "new"}
          teamId={teamId}
          task={dialogTask}
          members={members}
          milestones={milestones}
          timeZone={timeZone}
          bottomIndexOf={(status, excludingId) => columnOf(tasks, status).filter((t) => t.id !== excludingId).length}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
