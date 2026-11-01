"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import { formatDayShort } from "@/components/features/meetings/format";
import { MILESTONE_TEMPLATES, type MilestoneDTO, type MilestoneTemplateKey } from "@/contracts/milestones";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { endOfDayIso, spreadDueDates } from "./progress";

const KEYS = Object.keys(MILESTONE_TEMPLATES) as MilestoneTemplateKey[];

/** AC1/AC4: pick a template and a final date, see every milestone with its date, then create them. */
export function TemplateDialog({
  teamId,
  timeZone,
  nowIso,
  existing,
  onClose,
}: {
  teamId: string;
  timeZone: string;
  nowIso: string;
  existing: number;
  onClose: () => void;
}) {
  const [key, setKey] = useState<MilestoneTemplateKey>("presentation");
  const [finalDate, setFinalDate] = useState("");
  const { run, pending, fieldErrors } = useApiAction();

  const template = MILESTONE_TEMPLATES[key];
  const finalIso = endOfDayIso(finalDate, timeZone);
  const inPast = !!finalIso && new Date(finalIso).getTime() <= new Date(nowIso).getTime();
  // The server spreads from the moment it runs; the preview uses page-load time, which lands on the same days.
  const preview = useMemo(
    () =>
      finalIso && !inPast
        ? spreadDueDates(template.milestones.length, new Date(nowIso), new Date(finalIso), timeZone)
        : [],
    [finalIso, inPast, template, nowIso, timeZone],
  );

  async function create() {
    if (!finalIso || inPast) return;
    const made = await run(
      () =>
        apiFetch<MilestoneDTO[]>(`/api/v1/teams/${teamId}/milestones/apply-template`, {
          method: "POST",
          body: { templateKey: key, finalDueAt: finalIso },
        }),
      { success: `Added ${template.milestones.length} milestones` },
    );
    if (made) onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Use a template"
      description={
        existing > 0
          ? "The template's milestones are added after the ones you already have."
          : "Pick a template and when the final milestone is due. You'll see every milestone before anything is created."
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <FormField label="Template">
          <Select name="templateKey" value={key} onChange={(e) => setKey(e.target.value as MilestoneTemplateKey)}>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {MILESTONE_TEMPLATES[k].label} ({MILESTONE_TEMPLATES[k].milestones.length} milestones)
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Final milestone due"
          required
          hint={`The others are spread evenly from today (${timeZone}).`}
          error={inPast ? "Pick a date after today." : fieldErrors.finalDueAt}
        >
          <Input name="finalDueAt" type="date" value={finalDate} onChange={(e) => setFinalDate(e.target.value)} />
        </FormField>

        <section aria-labelledby="template-preview-heading" className="flex flex-col gap-2">
          <h3 id="template-preview-heading" className="text-sm font-medium text-slate-900">
            Preview
          </h3>
          {preview.length > 0 ? (
            <ol className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
              {template.milestones.map((title, i) => (
                <li key={title} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-slate-900">
                    {i + 1}. {title}
                  </span>
                  <span className="shrink-0 text-slate-600">{formatDayShort(preview[i], timeZone)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Alert>Choose the final due date to see when each milestone is due.</Alert>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={preview.length === 0}>
            Create {template.milestones.length} milestones
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
