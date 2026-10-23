"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import type { MeetingDTO } from "@/contracts/meetings";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { zonedInstant, zonedParts } from "./calendar-dates";

export interface MeetingDraft {
  title?: string;
  date: string; // YYYY-MM-DD in the viewer's zone
  startMinute: number;
  endMinute: number;
  location?: string;
  description?: string;
}

const toTime = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const fromTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Draft for editing an existing meeting, in the viewer's zone. */
export function draftFromMeeting(m: MeetingDTO, timeZone: string): MeetingDraft {
  const s = zonedParts(new Date(m.startsAt), timeZone);
  const e = zonedParts(new Date(m.endsAt), timeZone);
  const endMinute = e.date === s.date ? e.hours * 60 + e.minutes : 24 * 60;
  return {
    title: m.title,
    date: s.date,
    startMinute: s.hours * 60 + s.minutes,
    endMinute,
    location: m.location ?? "",
    description: m.description ?? "",
  };
}

/**
 * Schedule or edit a meeting. Times are entered in the viewer's time zone and sent as UTC instants.
 * A meeting can end at midnight (24:00); end times earlier than the start roll to the next day.
 */
export function MeetingFormDialog({
  teamId,
  timeZone,
  open,
  onClose,
  draft,
  editingId,
}: {
  teamId: string;
  timeZone: string;
  open: boolean;
  onClose: () => void;
  draft: MeetingDraft;
  editingId?: string;
}) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useApiAction();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = String(f.get("date"));
    const start = fromTime(String(f.get("start")));
    let end = fromTime(String(f.get("end")));
    if (end <= start) end += 24 * 60; // e.g. 11:00 PM → 12:30 AM
    const startsAt = zonedInstant(date, start, timeZone);
    const endsAt = new Date(zonedInstant(date, start, timeZone).getTime() + (end - start) * 60_000);
    const body = {
      title: String(f.get("title") ?? ""),
      location: String(f.get("location") ?? ""),
      description: String(f.get("description") ?? ""),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
    const saved = await run(
      () =>
        editingId
          ? apiFetch<MeetingDTO>(`/api/v1/teams/${teamId}/meetings/${editingId}`, { method: "PATCH", body })
          : apiFetch<MeetingDTO>(`/api/v1/teams/${teamId}/meetings`, { method: "POST", body }),
      {
        success: editingId
          ? "Meeting updated — the team was notified if the time or place changed"
          : "Meeting scheduled — the team was notified",
        refresh: !!editingId,
      },
    );
    if (saved) {
      onClose();
      if (!editingId) router.push(`/teams/${teamId}/calendar/${saved.id}`);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editingId ? "Edit meeting" : "Schedule a meeting"}
      description={`Times are in your time zone (${timeZone}).`}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required error={fieldErrors.title}>
          <Input name="title" defaultValue={draft.title} maxLength={120} placeholder="Sprint review" />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date" required>
            <Input name="date" type="date" defaultValue={draft.date} />
          </FormField>
          <FormField label="Starts" required error={fieldErrors.startsAt}>
            <Input name="start" type="time" step={900} defaultValue={toTime(draft.startMinute)} />
          </FormField>
          <FormField label="Ends" required error={fieldErrors.endsAt}>
            <Input name="end" type="time" step={900} defaultValue={toTime(draft.endMinute)} />
          </FormField>
        </div>
        <FormField label="Location or link" hint="A room, or a Zoom/Teams link." error={fieldErrors.location}>
          <Input name="location" defaultValue={draft.location} maxLength={300} />
        </FormField>
        <FormField label="Notes" error={fieldErrors.description}>
          <Textarea name="description" defaultValue={draft.description} rows={3} maxLength={2000} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {editingId ? "Save changes" : "Schedule"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
