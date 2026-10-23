"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  MAX_DRAFT_CHARS,
  MAX_INSTRUCTIONS_CHARS,
  MAX_RUNS_PER_USER_PER_DAY,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  type CoverageReportDTO,
  type WorkTypeValue,
} from "@/contracts/coverage";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatCount, PROVIDER_LABELS } from "./format";

type Phase = "idle" | "reading" | "checking";
const PHASE_TEXT: Record<Exclude<Phase, "idle">, string> = {
  reading: "Reading the instructions…",
  checking: "Checking your draft…",
};
/** The two model calls aren't streamed, so switch the message at a typical step-1 time. */
const CHECKING_AFTER_MS = 6_000;

function Counter({ length, max }: { length: number; max: number }) {
  const over = length > max;
  const near = !over && length >= max * 0.9;
  return (
    <span className={cn(over ? "font-medium text-danger-700" : near ? "font-medium text-warning-700" : undefined)}>
      {formatCount(length)} / {formatCount(max)} characters
      {over ? ` — ${formatCount(length - max)} over the limit` : near ? " — close to the limit" : ""}
    </span>
  );
}

/**
 * New check card (FR-07). Nothing is sent anywhere until the member ticks consent and clicks Run (NFR-02).
 * Errors from the server (400 field errors, 429 limit, 502 AI failure) show inline, not just as a toast.
 */
export function NewCheckForm({ teamId, remaining, provider }: { teamId: string; remaining: number; provider: string }) {
  const router = useRouter();
  const consentId = useId();
  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState<WorkTypeValue>("ASSIGNMENT");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const running = phase !== "idle";
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const tick = setInterval(() => {
      const ms = Date.now() - started;
      setElapsed(Math.floor(ms / 1000));
      if (ms >= CHECKING_AFTER_MS) setPhase("checking");
    }, 500);
    return () => clearInterval(tick);
  }, [running]);

  /** Fixing a field removes its error; once none are left, the summary ("Some fields need attention.") goes too. */
  function clearError(field: string) {
    if (!fieldErrors[field]) return;
    const rest = Object.fromEntries(Object.entries(fieldErrors).filter(([k]) => k !== field));
    setFieldErrors(rest);
    if (Object.keys(rest).length === 0) setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setElapsed(0);
    setPhase("reading");
    try {
      const report = await apiFetch<CoverageReportDTO>(`/api/v1/teams/${teamId}/coverage-reports`, {
        method: "POST",
        body: { title, workType, instructions, draft, consent },
      });
      router.push(`/teams/${teamId}/coverage/${report.id}`);
    } catch (err) {
      setPhase("idle");
      if (err instanceof ApiClientError) {
        setFieldErrors(err.fieldErrors);
        setError(err.message);
        // A 502 still saved a FAILED report and every run counts toward the limit: re-read the list below.
        if (err.status === 502 || err.status === 429) router.refresh();
      } else {
        setError("We couldn't reach StudyCrew. Check your connection and try again.");
      }
    }
  }

  const providerName = PROVIDER_LABELS[provider] ?? provider;
  const outOfRuns = remaining <= 0;

  return (
    <Card aria-labelledby="new-check-heading">
      <CardHeader>
        <CardTitle id="new-check-heading">New check</CardTitle>
        <p className={cn("text-sm", outOfRuns ? "font-medium text-danger-700" : "text-slate-600")}>
          {remaining} of {MAX_RUNS_PER_USER_PER_DAY} checks left today
        </p>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Alert tone="info">
            AI can miss or invent gaps. Treat results as suggestions; StudyCrew never writes your assignment.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <FormField label="Title" hint="So your team can find this check later, like “Lab 3 draft v2”." error={fieldErrors.title} required>
              <Input name="title" value={title} onChange={(e) => { setTitle(e.target.value); clearError("title"); }} maxLength={120} disabled={running} />
            </FormField>
            <FormField label="Type of work" error={fieldErrors.workType}>
              <Select name="workType" value={workType} onChange={(e) => { setWorkType(e.target.value as WorkTypeValue); clearError("workType"); }} disabled={running}>
                {WORK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORK_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField
            label="Assignment instructions"
            hint={<Counter length={instructions.trim().length} max={MAX_INSTRUCTIONS_CHARS} />}
            error={fieldErrors.instructions}
            required
          >
            <Textarea
              name="instructions"
              value={instructions}
              onChange={(e) => { setInstructions(e.target.value); clearError("instructions"); }}
              placeholder="Paste the assignment prompt, rubric, or topic list."
              className="min-h-36"
              disabled={running}
            />
          </FormField>

          <FormField label="Your draft" hint={<Counter length={draft.trim().length} max={MAX_DRAFT_CHARS} />} error={fieldErrors.draft} required>
            <Textarea
              name="draft"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); clearError("draft"); }}
              placeholder="Paste your team's draft, outline, or slide notes."
              className="min-h-48"
              disabled={running}
            />
          </FormField>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <input
                id={consentId}
                name="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => { setConsent(e.target.checked); clearError("consent"); }}
                disabled={running}
                aria-invalid={fieldErrors.consent ? true : undefined}
                aria-describedby={fieldErrors.consent ? `${consentId}-error` : undefined}
                className="mt-0.5 size-4 shrink-0 accent-brand-600"
              />
              <label htmlFor={consentId} className="text-sm text-slate-800">
                Send this text to the AI provider ({providerName}) for this check. We store the result for your team; the author or a
                leader can delete it.
              </label>
            </div>
            {fieldErrors.consent ? (
              <p id={`${consentId}-error`} className="text-xs text-danger-700" role="alert">
                {fieldErrors.consent}
              </p>
            ) : null}
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={running} disabled={outOfRuns}>
              <Sparkles aria-hidden /> Run check
            </Button>
            <p role="status" aria-live="polite" className="text-sm text-slate-700">
              {running ? (
                <>
                  {PHASE_TEXT[phase as Exclude<Phase, "idle">]} <span aria-hidden>({elapsed} s — this can take up to 30 s)</span>
                </>
              ) : outOfRuns ? (
                "You've used today's checks. You can run more tomorrow."
              ) : null}
            </p>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
