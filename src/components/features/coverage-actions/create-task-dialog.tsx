"use client";

import { useEffect, useState } from "react";
import type { CoverageItemDTO, CreateTaskFromItemInput } from "@/contracts/coverage";
import type { ProfileDTO } from "@/contracts/profile";
import type { TeamDetailDTO } from "@/contracts/teams";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { DEFAULT_TZ } from "@/lib/dates";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { endOfDayIso } from "./due-date";

type Loaded = { members: TeamDetailDTO["members"]; timeZone: string };

/**
 * "Create task" for one suggestion. The slot only gets `teamId` + `item`, so the member list (PB-04) and the viewer's
 * time zone (PB-02) load when the dialog opens.
 */
export function CreateTaskDialog({
  teamId,
  item,
  pending,
  onCancel,
  onSubmit,
}: {
  teamId: string;
  item: CoverageItemDTO;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateTaskFromItemInput) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [due, setDue] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiFetch<TeamDetailDTO>(`/api/v1/teams/${teamId}`, { signal: controller.signal }),
      apiFetch<ProfileDTO>("/api/v1/me/profile", { signal: controller.signal }),
    ])
      .then(([team, me]) => setLoaded({ members: team.members, timeZone: me.timezone || DEFAULT_TZ }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof ApiClientError ? err.message : "We couldn't load your team. Try again.");
      });
    return () => controller.abort();
  }, [teamId]);

  const toggle = (id: string) =>
    setAssigneeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Create a task from this suggestion"
      description={
        <>
          Adds it to To Do{item.status === "MISSING" ? " with High priority" : ""}:
          <span className="mt-1 line-clamp-3 block text-slate-800">
            “{item.suggestion?.trim() || item.requirement}”
          </span>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loaded) return;
          onSubmit({ assigneeIds, dueAt: endOfDayIso(due, loaded.timeZone) });
        }}
      >
        {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
        {!loaded && !loadError ? <p className="text-sm text-slate-600">Loading your team…</p> : null}
        {loaded ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-slate-900">Assign to (optional)</legend>
              {loaded.members.map((m) => (
                <label key={m.user.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="accent-brand-600 size-4"
                    checked={assigneeIds.includes(m.user.id)}
                    onChange={() => toggle(m.user.id)}
                  />
                  {m.user.name}
                </label>
              ))}
            </fieldset>
            <FormField label="Due date (optional)" hint={`Due by the end of that day (${loaded.timeZone}).`}>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </FormField>
          </>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!loaded}>
            Create task
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
