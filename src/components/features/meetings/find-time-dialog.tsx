"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import type { UserSummaryDTO } from "@/contracts/common";
import type { MeetingSuggestionDTO } from "@/contracts/meetings";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { addDays } from "./calendar-dates";
import { SuggestionText } from "./suggestion-text";

/** "Find a time": search a date range and pick from ranked suggestions. */
export function FindTimeDialog({
  teamId,
  timeZone,
  today,
  members,
  open,
  onClose,
  onPick,
}: {
  teamId: string;
  timeZone: string;
  today: string;
  members: UserSummaryDTO[];
  open: boolean;
  onClose: () => void;
  onPick: (s: MeetingSuggestionDTO) => void;
}) {
  const [results, setResults] = useState<MeetingSuggestionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const qs = new URLSearchParams({
      from: String(f.get("from")),
      to: String(f.get("to")),
      durationMinutes: String(f.get("duration")),
      earliestHour: String(f.get("earliest")),
      latestHour: String(f.get("latest")),
      limit: "8",
    });
    setLoading(true);
    setError(null);
    try {
      setResults(await apiFetch<MeetingSuggestionDTO[]>(`/api/v1/teams/${teamId}/meeting-suggestions?${qs}`));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't search right now. Try again.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const hours = Array.from({ length: 25 }, (_, h) => h);
  const label = (h: number) =>
    h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Find a time"
      description="Ranked by how many teammates are free, using everyone's weekly availability and existing meetings."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From">
            <Input name="from" type="date" defaultValue={today} min={today} />
          </FormField>
          <FormField label="To">
            <Input name="to" type="date" defaultValue={addDays(today, 6)} min={today} />
          </FormField>
          <FormField label="Length">
            <Select name="duration" defaultValue="60">
              {[30, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Not before">
              <Select name="earliest" defaultValue="8">
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {label(h)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Not after">
              <Select name="latest" defaultValue="22">
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {label(h)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={loading}>
            Search
          </Button>
        </div>
      </form>

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {results ? (
        <div className="mt-4" aria-live="polite">
          {results.length === 0 ? (
            <Alert tone="warning">
              Nobody has marked themselves free in that window. Try other days or wider hours, or ask teammates to fill
              in their availability.
            </Alert>
          ) : (
            <ol className="flex max-h-72 flex-col divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {results.map((s) => (
                <li key={s.startsAt} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <SuggestionText suggestion={s} timeZone={timeZone} members={members} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={s.availableCount === s.totalMembers ? "success" : "warning"}>
                      {s.availableCount}/{s.totalMembers} free
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => onPick(s)}>
                      Schedule
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
