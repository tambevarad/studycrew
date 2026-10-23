"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical } from "lucide-react";
import type { TaskDTO } from "@/contracts/tasks";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dueDisplay, PRIORITY_LABELS, PRIORITY_TONES } from "./board-utils";
import { MoveMenu, type MoveTarget } from "./move-menu";

const DUE_TEXT = { danger: "text-danger-700", warning: "text-warning-700", neutral: "text-slate-600" } as const;

/** Card body shared by the sortable card and the drag overlay. */
export function TaskCardBody({
  task,
  now,
  timeZone,
  onOpen,
  actions,
  handle,
}: {
  task: TaskDTO;
  now: Date;
  timeZone: string;
  onOpen?: () => void;
  actions?: React.ReactNode;
  handle?: React.ReactNode;
}) {
  const due = dueDisplay(task, now, timeZone);
  return (
    <div className="flex gap-2">
      {handle}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="hover:text-brand-700 text-left text-sm font-medium break-words text-slate-900"
        >
          {task.title}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONES[task.priority]}>
            <span className="sr-only">Priority: </span>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          {due ? (
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", DUE_TEXT[due.tone])}>
              <CalendarClock className="size-3.5" aria-hidden />
              {due.label}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          {task.assignees.length > 0 ? (
            <AvatarStack names={task.assignees.map((a) => a.name)} />
          ) : (
            <span className="text-xs text-slate-500">Unassigned</span>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  now,
  timeZone,
  onOpen,
  onMove,
}: {
  task: TaskDTO;
  now: Date;
  timeZone: string;
  onOpen: () => void;
  onMove: (target: MoveTarget) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-surface rounded-md border border-slate-200 p-3 shadow-sm", isDragging && "opacity-40")}
    >
      <TaskCardBody
        task={task}
        now={now}
        timeZone={timeZone}
        onOpen={onOpen}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag “${task.title}”`}
            className="-ml-1 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 hover:text-slate-700 active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
        actions={<MoveMenu title={task.title} status={task.status} onMove={onMove} />}
      />
    </li>
  );
}
