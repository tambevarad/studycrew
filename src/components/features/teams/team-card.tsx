"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import type { JoinRequestDTO, TeamSummaryDTO } from "@/contracts/teams";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { isTeamFull, seatsLabel } from "./team-utils";

const MESSAGE_MAX = 300;

/** One search result on /teams: what the team is, how full it is, and what I can do (open / pending / ask). */
export function TeamCard({ team }: { team: TeamSummaryDTO }) {
  const full = isTeamFull(team.memberCount);
  return (
    <Card className="flex flex-col gap-3 p-5" aria-labelledby={`team-${team.id}-name`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`team-${team.id}-name`} className="truncate text-base font-semibold text-slate-900">
            {team.name}
          </h3>
          <p className="text-brand-700 text-sm font-medium">{team.courseCode}</p>
        </div>
        {full ? <Badge tone="warning">Full</Badge> : <Badge tone="success">Open</Badge>}
      </div>
      {team.description ? <p className="line-clamp-3 text-sm text-slate-600">{team.description}</p> : null}
      <p className="flex items-center gap-1.5 text-sm text-slate-600">
        <Users className="size-4" aria-hidden />
        {seatsLabel(team.memberCount)}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
        {team.myRole ? (
          <>
            <Badge tone="brand">{team.myRole === "LEADER" ? "Leader" : "Member"}</Badge>
            <LinkButton href={`/teams/${team.id}`} size="sm" variant="outline">
              Open team
            </LinkButton>
          </>
        ) : team.hasPendingRequest ? (
          <Badge tone="neutral">Request pending</Badge>
        ) : full ? (
          <span className="text-sm text-slate-600">No seats left</span>
        ) : (
          <AskToJoinButton team={team} />
        )}
      </div>
    </Card>
  );
}

function AskToJoinButton({ team }: { team: TeamSummaryDTO }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { run, pending, fieldErrors } = useApiAction();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const sent = await run(
      () =>
        apiFetch<JoinRequestDTO>("/api/v1/join-requests", {
          method: "POST",
          body: { teamId: team.id, message: message.trim() || undefined },
        }),
      { success: `Request sent to ${team.name}` },
    );
    if (sent) setOpen(false);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} aria-label={`Ask to join ${team.name}`}>
        Ask to join
      </Button>
      {/* Mounted only while open: the shared Dialog uses a fixed heading id, so one per page. */}
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={`Ask to join ${team.name}`}
          description="The team's leaders get a notification and can approve or decline."
        >
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormField
              label="Message (optional)"
              hint={`${message.length} / ${MESSAGE_MAX}. Say what you can help with.`}
              error={fieldErrors.message}
            >
              <Textarea
                name="message"
                rows={3}
                maxLength={MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Send request
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
