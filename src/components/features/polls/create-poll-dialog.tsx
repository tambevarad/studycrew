"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Label } from "@/components/ui/input";
import type { PollDTO } from "@/contracts/polls";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { closeInputToIso, defaultCloseInputValue, MAX_OPTIONS, MIN_OPTIONS } from "./poll-utils";

/** Mounted only while open (the shared Dialog uses a fixed heading id). */
export function CreatePollDialog({ teamId, timeZone, onClose }: { teamId: string; timeZone: string; onClose: () => void }) {
  const { run, pending, fieldErrors } = useApiAction();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  // Only ever rendered in the browser (after a click), so reading the clock here can't cause a hydration mismatch.
  const [closesAt, setClosesAt] = useState(() => defaultCloseInputValue(new Date(), timeZone));
  const [closeError, setCloseError] = useState<string | null>(null);

  const optionsError =
    fieldErrors.options ?? Object.entries(fieldErrors).find(([k]) => k.startsWith("options."))?.[1];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const iso = closeInputToIso(closesAt, timeZone);
    if (!iso) {
      setCloseError("Pick a closing date and time.");
      return;
    }
    setCloseError(null);
    const created = await run(
      () =>
        apiFetch<PollDTO>(`/api/v1/teams/${teamId}/polls`, {
          method: "POST",
          body: { question, options: options.map((o) => o.trim()).filter(Boolean), closesAt: iso },
        }),
      { success: "Poll started" },
    );
    if (created) onClose();
  }

  return (
    <Dialog open onClose={onClose} title="New poll" description="Everyone on the team can vote and change their vote until it closes.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate aria-label="New poll">
        <FormField label="Question" required error={fieldErrors.question}>
          <Input
            name="question"
            maxLength={200}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Where should we meet on Friday?"
          />
        </FormField>

        <fieldset className="flex flex-col gap-2" aria-describedby={optionsError ? "poll-options-error" : "poll-options-hint"}>
          <legend className="mb-1 text-sm font-medium text-slate-800">
            Options<span className="text-danger-600"> *</span>
          </legend>
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Option ${i + 1}`}
                name={`option-${i}`}
                maxLength={100}
                value={value}
                aria-invalid={fieldErrors[`options.${i}`] ? true : undefined}
                onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove option ${i + 1}`}
                disabled={options.length <= MIN_OPTIONS}
                onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <p id="poll-options-hint" className="text-xs text-slate-600">
              {MIN_OPTIONS}–{MAX_OPTIONS} different options. {options.length} of {MAX_OPTIONS}.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={options.length >= MAX_OPTIONS}
              onClick={() => setOptions((o) => [...o, ""])}
            >
              <Plus aria-hidden />
              Add option
            </Button>
          </div>
          {optionsError ? (
            <p id="poll-options-error" className="text-danger-700 text-xs" role="alert">
              {optionsError}
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="poll-closes-at">
            Closes at<span className="text-danger-600"> *</span>
          </Label>
          <Input
            id="poll-closes-at"
            name="closesAt"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            aria-describedby="poll-closes-hint"
            aria-invalid={closeError || fieldErrors.closesAt ? true : undefined}
          />
          <p id="poll-closes-hint" className="text-xs text-slate-600">
            In your time zone ({timeZone.replaceAll("_", " ")}). After this, the result is final.
          </p>
          {closeError || fieldErrors.closesAt ? (
            <p className="text-danger-700 text-xs" role="alert">
              {closeError ?? fieldErrors.closesAt}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Start poll
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
