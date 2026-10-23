"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import type { JoinRequestDTO, TeamDetailDTO, TeamInviteDTO, TeamMemberDTO } from "@/contracts/teams";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { inviteLink, parseEmailList, seatsLabel } from "./team-utils";

type Confirm =
  | { kind: "remove"; member: TeamMemberDTO }
  | { kind: "leave" }
  | { kind: "reset-link" }
  | null;

const noSubscribe = () => () => {};

/** PB-04 `/teams/[teamId]/members`: roster, invite link, email invites, join requests, leave. */
export function MembersView({
  team,
  joinRequests,
  meId,
  justCreated,
  requestTimeLabels,
}: {
  team: TeamDetailDTO;
  /** Pending requests; empty for non-leaders (they can't see them). */
  joinRequests: JoinRequestDTO[];
  meId: string;
  justCreated: boolean;
  /** request id → "Sent 3 h ago", built on the server (labels.ts) so nothing is Intl-formatted during hydration. */
  requestTimeLabels: Record<string, string>;
}) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const isLeader = team.myRole === "LEADER";
  const leaderCount = team.members.filter((m) => m.role === "LEADER").length;
  const imOnlyLeader = isLeader && leaderCount === 1;

  async function setRole(member: TeamMemberDTO, role: "LEADER" | "MEMBER") {
    await run(
      () => apiFetch(`/api/v1/teams/${team.id}/members/${member.user.id}`, { method: "PATCH", body: { role } }),
      { success: role === "LEADER" ? `${member.user.name} is now a leader` : `${member.user.name} is now a member` },
    );
  }

  async function onConfirm() {
    if (!confirm) return;
    if (confirm.kind === "remove") {
      const ok = await run(
        () => apiFetch(`/api/v1/teams/${team.id}/members/${confirm.member.user.id}`, { method: "DELETE" }),
        { success: `${confirm.member.user.name} was removed` },
      );
      if (ok) setConfirm(null);
    } else if (confirm.kind === "leave") {
      const ok = await run(() => apiFetch(`/api/v1/teams/${team.id}/members/${meId}`, { method: "DELETE" }), {
        success: `You left ${team.name}`,
        refresh: false,
      });
      if (ok) {
        router.push("/teams");
        router.refresh();
      }
    } else {
      const ok = await run(() => apiFetch(`/api/v1/teams/${team.id}/invite-code`, { method: "POST" }), {
        success: "New invite link created. The old link no longer works.",
      });
      if (ok) setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Members"
        description={`${seatsLabel(team.memberCount)}. ${isLeader ? "You lead this team." : "Leaders manage roles and requests."}`}
      />

      {justCreated ? (
        <Alert tone="success">Your team is ready. Share this link to invite teammates.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          {isLeader ? (
            <JoinRequestsCard requests={joinRequests} timeLabels={requestTimeLabels} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Team members</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col divide-y divide-slate-100" aria-label="Team members">
                {team.members.map((m) => {
                  const isMe = m.user.id === meId;
                  return (
                    <li key={m.user.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar name={m.user.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">
                          {m.user.name}
                          {isMe ? <span className="font-normal text-slate-600"> (you)</span> : null}
                        </p>
                        <p className="truncate text-sm text-slate-600">{m.user.email}</p>
                      </div>
                      <Badge tone={m.role === "LEADER" ? "brand" : "neutral"}>
                        {m.role === "LEADER" ? "Leader" : "Member"}
                      </Badge>
                      {isLeader && !isMe ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setRole(m, m.role === "LEADER" ? "MEMBER" : "LEADER")}
                            aria-label={m.role === "LEADER" ? `Make ${m.user.name} a member` : `Make ${m.user.name} a leader`}
                          >
                            {m.role === "LEADER" ? "Make member" : "Make leader"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger-700 hover:bg-danger-50"
                            disabled={pending}
                            onClick={() => setConfirm({ kind: "remove", member: m })}
                            aria-label={`Remove ${m.user.name}`}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave team</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              {imOnlyLeader ? (
                <p id="leave-blocked" className="max-w-md text-sm text-slate-600">
                  You&apos;re the only leader. Make someone else a leader before you leave, so the team isn&apos;t left
                  without one.
                </p>
              ) : (
                <p className="max-w-md text-sm text-slate-600">
                  You&apos;ll lose access to this team&apos;s board, calendar, and files. You can rejoin with the invite
                  link.
                </p>
              )}
              <Button
                variant="outline"
                className="border-danger-100 text-danger-700 hover:bg-danger-50"
                disabled={imOnlyLeader || pending}
                aria-describedby={imOnlyLeader ? "leave-blocked" : undefined}
                onClick={() => setConfirm({ kind: "leave" })}
              >
                Leave team
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {team.inviteCode ? (
            <InviteLinkCard
              inviteCode={team.inviteCode}
              isLeader={isLeader}
              onReset={() => setConfirm({ kind: "reset-link" })}
            />
          ) : null}
          {isLeader ? <InviteByEmailCard teamId={team.id} /> : null}
        </div>
      </div>

      {confirm ? (
        <ConfirmDialog
          open
          onCancel={() => setConfirm(null)}
          onConfirm={onConfirm}
          pending={pending}
          {...(confirm.kind === "remove"
            ? {
                title: `Remove ${confirm.member.user.name}?`,
                description: `They'll lose access to ${team.name}. Their tasks stay on the board. They can rejoin with the invite link.`,
                confirmLabel: "Remove",
              }
            : confirm.kind === "leave"
              ? {
                  title: `Leave ${team.name}?`,
                  description: "You'll lose access to the board, calendar, and files until you rejoin.",
                  confirmLabel: "Leave team",
                }
              : {
                  title: "Reset the invite link?",
                  description: "Anyone with the current link won't be able to use it. Share the new link instead.",
                  confirmLabel: "Reset link",
                })}
        />
      ) : null}
    </div>
  );
}

function JoinRequestsCard({ requests, timeLabels }: { requests: JoinRequestDTO[]; timeLabels: Record<string, string> }) {
  const { run, pending } = useApiAction();

  function decide(r: JoinRequestDTO, decision: "APPROVE" | "DECLINE") {
    return run(
      () => apiFetch(`/api/v1/join-requests/${r.id}/decision`, { method: "POST", body: { decision } }),
      { success: decision === "APPROVE" ? `${r.user.name} joined the team` : `Declined ${r.user.name}'s request` },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join requests{requests.length ? ` (${requests.length})` : ""}</CardTitle>
      </CardHeader>
      <CardBody>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-600">No pending requests. Classmates who find your team in search show up here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100" aria-label="Pending join requests">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={r.user.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{r.user.name}</p>
                    <p className="truncate text-sm text-slate-600">
                      {r.user.email} · {timeLabels[r.id]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => decide(r, "DECLINE")}
                      aria-label={`Decline ${r.user.name}`}
                    >
                      Decline
                    </Button>
                    <Button size="sm" disabled={pending} onClick={() => decide(r, "APPROVE")} aria-label={`Approve ${r.user.name}`}>
                      Approve
                    </Button>
                  </div>
                </div>
                {r.message ? (
                  <blockquote className="ml-10 border-l-2 border-slate-200 pl-3 text-sm text-slate-700">{r.message}</blockquote>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function InviteLinkCard({ inviteCode, isLeader, onReset }: { inviteCode: string; isLeader: boolean; onReset: () => void }) {
  // The origin is only known in the browser; render the path on the server, the full URL after hydration.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const link = inviteLink(origin, inviteCode);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically. Select the link and copy it instead.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite link</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <FormField label="Share this link" hint="Anyone signed in with this link can join (up to 8 members).">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          {isLeader ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RefreshCw aria-hidden />
              Reset link
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function InviteByEmailCard({ teamId }: { teamId: string }) {
  const [raw, setRaw] = useState("");
  const { run, pending, fieldErrors } = useApiAction();
  const emailError = Object.entries(fieldErrors).find(([k]) => k === "emails" || k.startsWith("emails."))?.[1];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emails = parseEmailList(raw);
    if (emails.length === 0) {
      toast.error("Type at least one email address.");
      return;
    }
    const invites = await run(() =>
      apiFetch<TeamInviteDTO[]>(`/api/v1/teams/${teamId}/invites`, { method: "POST", body: { emails } }),
    );
    if (!invites) return;
    setRaw("");
    if (invites.length === 0) toast.info("Everyone you listed is already a member or has a pending invite.");
    else toast.success(`Invited ${invites.length === 1 ? invites[0].email : `${invites.length} people`}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite by email</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <FormField
            label="Email addresses"
            hint="Up to 10, separated by commas or new lines. People with a StudyCrew account see it on their Find teams page."
            error={emailError}
          >
            <Textarea name="emails" rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="classmate@school.edu" />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              Send invites
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
