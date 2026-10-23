"use client";

import { CalendarDays, MapPin, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { UserSummaryDTO } from "@/contracts/common";
import type { MeetingDTO, RsvpValue } from "@/contracts/meetings";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";
import { draftFromMeeting, MeetingFormDialog } from "./meeting-form-dialog";

const OPTIONS: Array<{ value: RsvpValue; label: string; active: string }> = [
  { value: "YES", label: "Going", active: "bg-success-700 text-white" },
  { value: "MAYBE", label: "Maybe", active: "bg-warning-700 text-white" },
  { value: "NO", label: "Can't make it", active: "bg-danger-600 text-white" },
];

export function MeetingDetail({
  meeting,
  members,
  timeZone,
  canManage,
  isPast,
}: {
  meeting: MeetingDTO;
  members: UserSummaryDTO[];
  timeZone: string;
  canManage: boolean;
  /** Computed on the server so render stays pure. */
  isPast: boolean;
}) {
  const router = useRouter();
  const rsvp = useApiAction();
  const del = useApiAction();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const base = `/api/v1/teams/${meeting.teamId}/meetings/${meeting.id}`;

  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(meeting.startsAt));
  const range = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatRange(new Date(meeting.startsAt), new Date(meeting.endsAt));
  const byResponse = (r: RsvpValue) => meeting.rsvps.filter((x) => x.response === r).map((x) => x.user);
  const answered = new Set(meeting.rsvps.map((r) => r.user.id));
  const noAnswer = members.filter((m) => !answered.has(m.id));
  const isLink = meeting.location ? /^https?:\/\//i.test(meeting.location) : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{meeting.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
            <CalendarDays className="size-4 text-slate-500" aria-hidden /> {day} · {range}
            {isPast ? <Badge className="ml-1">Past</Badge> : null}
          </p>
          {meeting.location ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
              <MapPin className="size-4 text-slate-500" aria-hidden />
              {isLink ? (
                <a
                  href={meeting.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  {meeting.location}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                meeting.location
              )}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">Scheduled by {meeting.createdBy.name}</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Edit
            </Button>
            <Button variant="outline" className="text-danger-700" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden /> Cancel meeting
            </Button>
          </div>
        ) : null}
      </div>

      {meeting.description ? (
        <p className="max-w-3xl text-sm whitespace-pre-wrap text-slate-800">{meeting.description}</p>
      ) : null}

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-900" id="rsvp-label">
              Are you coming?
            </span>
            <div
              role="group"
              aria-labelledby="rsvp-label"
              className="inline-flex rounded-md border border-slate-300 p-0.5"
            >
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={meeting.myRsvp === o.value}
                  disabled={rsvp.pending}
                  onClick={() =>
                    rsvp.run(() => apiFetch(`${base}/rsvp`, { method: "PUT", body: { response: o.value } }), {
                      success: "Answer saved",
                    })
                  }
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium",
                    meeting.myRsvp === o.value ? o.active : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Going", people: byResponse("YES"), tone: "success" as const },
              { label: "Maybe", people: byResponse("MAYBE"), tone: "warning" as const },
              { label: "Can't make it", people: byResponse("NO"), tone: "danger" as const },
              { label: "No answer", people: noAnswer, tone: "neutral" as const },
            ].map((g) => (
              <div key={g.label} className="flex flex-col gap-1.5">
                <dt className="flex items-center gap-2 text-sm text-slate-700">
                  {g.label} <Badge tone={g.tone}>{g.people.length}</Badge>
                </dt>
                <dd className="flex flex-col gap-1">
                  {g.people.length > 0 ? <AvatarStack names={g.people.map((p) => p.name)} /> : null}
                  <span className="text-xs text-slate-600">{g.people.map((p) => p.name).join(", ") || "—"}</span>
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {editing ? (
        <MeetingFormDialog
          teamId={meeting.teamId}
          timeZone={timeZone}
          open
          onClose={() => setEditing(false)}
          draft={draftFromMeeting(meeting, timeZone)}
          editingId={meeting.id}
        />
      ) : null}
      {canManage ? (
        <ConfirmDialog
          open={confirming}
          onCancel={() => setConfirming(false)}
          pending={del.pending}
          confirmLabel="Cancel meeting"
          title={`Cancel “${meeting.title}”?`}
          description="Everyone on the team will be notified. This can't be undone."
          onConfirm={async () => {
            const ok = await del.run(() => apiFetch(base, { method: "DELETE" }), {
              success: "Meeting cancelled",
              refresh: false,
            });
            if (ok) router.push(`/teams/${meeting.teamId}/calendar`);
          }}
        />
      ) : null}
    </div>
  );
}
