"use client";

import { CalendarClock, Link2, Pencil, Trash2, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { formatDayShort } from "@/components/features/meetings/format";
import type { MilestoneDTO } from "@/contracts/milestones";
import { TASK_STATUS_LABELS, type TaskStatusValue } from "@/contracts/tasks";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";

export type TaskOption = { id: string; title: string; status: TaskStatusValue; milestoneId: string | null };

const STATUS_TONE: Record<TaskStatusValue, "neutral" | "brand" | "warning" | "success"> = {
  TODO: "neutral",
  IN_PROGRESS: "brand",
  REVIEW: "warning",
  DONE: "success",
};

export function MilestoneCard({
  teamId,
  milestone: m,
  tasks,
  timeZone,
  nowIso,
  onEdit,
  onDelete,
}: {
  teamId: string;
  milestone: MilestoneDTO;
  tasks: TaskOption[];
  timeZone: string;
  nowIso: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [toLink, setToLink] = useState("");
  const link = useApiAction();
  const unlink = useApiAction();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const linked = tasks.filter((t) => t.milestoneId === m.id);
  const others = tasks.filter((t) => t.milestoneId !== m.id);
  const done = m.taskCount > 0 && m.doneCount === m.taskCount;
  const overdue = !!m.dueAt && !done && new Date(m.dueAt).getTime() < new Date(nowIso).getTime();
  const headingId = `milestone-${m.id}`;

  async function linkTask() {
    if (!toLink) return;
    const ok = await link.run(
      () =>
        apiFetch<MilestoneDTO>(`/api/v1/teams/${teamId}/milestones/${m.id}/tasks`, {
          method: "POST",
          body: { taskId: toLink },
        }),
      { success: "Task linked" },
    );
    if (ok) setToLink("");
  }

  async function unlinkTask(taskId: string) {
    setUnlinkingId(taskId);
    // PB-05 owns tasks: unlinking is a task edit through its PATCH route.
    await unlink.run(
      () => apiFetch(`/api/v1/teams/${teamId}/tasks/${taskId}`, { method: "PATCH", body: { milestoneId: null } }),
      { success: "Task unlinked" },
    );
    setUnlinkingId(null);
  }

  return (
    <Card className="flex flex-col gap-4 p-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={headingId} className="text-base font-semibold text-slate-900">
            {m.title}
          </h3>
          {m.dueAt ? (
            <p
              className={cn(
                "inline-flex items-center gap-1 text-sm",
                overdue ? "text-danger-700 font-medium" : "text-slate-600",
              )}
            >
              <CalendarClock aria-hidden className="size-4" />
              {overdue ? "Overdue: was due " : "Due "}
              {formatDayShort(new Date(m.dueAt), timeZone)}
            </p>
          ) : (
            <p className="text-sm text-slate-500">No due date</p>
          )}
          {m.description ? <p className="text-sm text-slate-700">{m.description}</p> : null}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit “${m.title}”`}>
            <Pencil aria-hidden /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete “${m.title}”`}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-700">
            {m.taskCount === 0 ? "No tasks linked yet" : `${m.doneCount} of ${m.taskCount} tasks done`}
          </span>
          <span className="font-semibold text-slate-900">{m.percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`Progress of “${m.title}”`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={m.percent}
          aria-valuetext={`${m.percent}% (${m.doneCount} of ${m.taskCount} tasks done)`}
          className="h-2 overflow-hidden rounded-full bg-slate-100"
        >
          <div className="bg-success-600 h-full rounded-full transition-[width]" style={{ width: `${m.percent}%` }} />
        </div>
      </div>

      {linked.length > 0 ? (
        <ul
          className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200"
          aria-label={`Tasks in “${m.title}”`}
        >
          {linked.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <Link
                href={`/teams/${teamId}/board?task=${t.id}`}
                className="min-w-0 truncate text-sm text-slate-900 underline-offset-2 hover:underline"
              >
                {t.title}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={STATUS_TONE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Unlink “${t.title}”`}
                  title="Unlink from this milestone"
                  loading={unlinkingId === t.id}
                  disabled={unlinkingId !== null}
                  onClick={() => unlinkTask(t.id)}
                >
                  <Unlink aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {others.length > 0 ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void linkTask();
          }}
        >
          <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-medium text-slate-800">
            Link a task
            <Select value={toLink} onChange={(e) => setToLink(e.target.value)}>
              <option value="">Choose a task…</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.milestoneId ? " (moves from another milestone)" : ""}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary" disabled={!toLink} loading={link.pending}>
            <Link2 aria-hidden /> Link
          </Button>
        </form>
      ) : m.taskCount === 0 ? (
        <p className="text-sm text-slate-500">Create tasks on the board first, then link them here.</p>
      ) : null}
    </Card>
  );
}
