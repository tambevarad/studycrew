"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import type { MilestoneDTO } from "@/contracts/milestones";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { dateInputValue, endOfDayIso } from "./progress";

/** Create (milestone = null) or edit one milestone. A due date is a day: 11:59 pm in the viewer's zone. */
export function MilestoneFormDialog({
  teamId,
  timeZone,
  milestone,
  onClose,
}: {
  teamId: string;
  timeZone: string;
  milestone: MilestoneDTO | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [due, setDue] = useState(dateInputValue(milestone?.dueAt ?? null, timeZone));
  const { run, pending, fieldErrors } = useApiAction();

  async function submit() {
    const body = { title, description, dueAt: endOfDayIso(due, timeZone) };
    const base = `/api/v1/teams/${teamId}/milestones`;
    const saved = await run(
      () =>
        milestone
          ? apiFetch<MilestoneDTO>(`${base}/${milestone.id}`, { method: "PATCH", body })
          : apiFetch<MilestoneDTO>(base, { method: "POST", body }),
      { success: milestone ? "Milestone saved" : "Milestone added" },
    );
    if (saved) onClose();
  }

  return (
    <Dialog open onClose={onClose} title={milestone ? "Edit milestone" : "New milestone"}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label="Title" required error={fieldErrors.title}>
          <Input name="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </FormField>
        <FormField label="Description (optional)" error={fieldErrors.description}>
          <Textarea
            name="description"
            maxLength={1000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        <FormField
          label="Due date (optional)"
          hint={`Due by the end of that day (${timeZone}).`}
          error={fieldErrors.dueAt}
        >
          <Input name="dueAt" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {milestone ? "Save" : "Add milestone"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
