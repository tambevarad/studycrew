"use client";

import { useState } from "react";
import type { UserSummaryDTO } from "@/contracts/common";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type CreateTaskInput,
  type TaskDTO,
  type TaskPriorityValue,
  type TaskStatusValue,
  type UpdateTaskInput,
} from "@/contracts/tasks";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { fromDueInputValue, PRIORITY_LABELS, toDueInputValue } from "./board-utils";

export interface TaskDialogProps {
  teamId: string;
  /** null → new task. */
  task: TaskDTO | null;
  members: UserSummaryDTO[];
  milestones: { id: string; title: string }[];
  timeZone: string;
  /** Index at the bottom of a column, for moving an edited task to another column. */
  bottomIndexOf: (status: TaskStatusValue, excludingId: string) => number;
  onClose: () => void;
}

export function TaskDialog({ teamId, task, members, milestones, timeZone, bottomIndexOf, onClose }: TaskDialogProps) {
  const editing = task !== null;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatusValue>(task?.status ?? "TODO");
  const [priority, setPriority] = useState<TaskPriorityValue>(task?.priority ?? "MEDIUM");
  const [due, setDue] = useState(toDueInputValue(task?.dueAt ?? null, timeZone));
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees.map((a) => a.id) ?? []);
  const [milestoneId, setMilestoneId] = useState(task?.milestoneId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();
  const save = useApiAction();
  const remove = useApiAction();
  const errors: Record<string, string | undefined> = {
    ...save.fieldErrors,
    ...(titleError ? { title: titleError } : {}),
  };

  const toggleAssignee = (id: string) =>
    setAssigneeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Give the task a title.");
      return;
    }
    setTitleError(undefined);
    const dueAt = fromDueInputValue(due, timeZone);
    const fields = {
      title: title.trim(),
      priority,
      dueAt,
      assigneeIds,
      ...(milestones.length > 0 ? { milestoneId: milestoneId || null } : {}),
    };
    const ok = await save.run(
      async () => {
        if (!task) {
          const body: CreateTaskInput = { ...fields, status, description: description.trim() || undefined };
          return apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/tasks`, { method: "POST", body });
        }
        const body: UpdateTaskInput = { ...fields, description: description.trim() || null };
        const updated = await apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/tasks/${task.id}`, { method: "PATCH", body });
        if (status === task.status) return updated;
        return apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/tasks/${task.id}/move`, {
          method: "POST",
          body: { status, index: bottomIndexOf(status, task.id) },
        });
      },
      { success: editing ? "Task saved" : "Task added" },
    );
    if (ok) onClose();
  }

  async function onDelete() {
    if (!task) return;
    const ok = await remove.run(
      () => apiFetch<{ deleted: true }>(`/api/v1/teams/${teamId}/tasks/${task.id}`, { method: "DELETE" }),
      { success: "Task deleted" },
    );
    if (ok) {
      setConfirmDelete(false);
      onClose();
    }
  }

  return (
    <>
      {/* Stays open under the delete confirmation: the shared Dialog calls onClose whenever it closes. */}
      <Dialog open onClose={onClose} title={editing ? "Edit task" : "New task"}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField label="Title" required error={errors.title}>
            <Input name="title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Description" error={errors.description}>
            <Textarea
              name="description"
              maxLength={5000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Status">
              <Select name="status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatusValue)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority" error={errors.priority}>
              <Select
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriorityValue)}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField
            label="Due"
            hint={`Date and time in your time zone (${timeZone.replaceAll("_", " ")}). Leave empty for no due date.`}
            error={errors.dueAt}
          >
            <Input name="dueAt" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </FormField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-slate-800">Assignees</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="assigneeIds"
                    value={m.id}
                    checked={assigneeIds.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                    className="accent-brand-600 size-4"
                  />
                  {m.name}
                </label>
              ))}
            </div>
            {errors.assigneeIds ? (
              <p className="text-danger-700 text-xs" role="alert">
                {errors.assigneeIds}
              </p>
            ) : null}
          </fieldset>
          {milestones.length > 0 ? (
            <FormField label="Milestone" error={errors.milestoneId}>
              <Select name="milestoneId" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                <option value="">No milestone</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {editing ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={save.pending}>
                {editing ? "Save task" : "Add task"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
      {task && confirmDelete ? (
        <ConfirmDialog
          open
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDelete}
          pending={remove.pending}
          title="Delete task?"
          description={`Delete “${task.title}”? This can't be undone.`}
        />
      ) : null}
    </>
  );
}
