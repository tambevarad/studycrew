"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { JoinRequestDTO, TeamDetailDTO, TeamInviteDTO } from "@/contracts/teams";
import { apiFetch } from "@/lib/api-client";
import { formatDate, relativeTime } from "@/lib/dates";
import { useApiAction } from "@/lib/use-api-action";

/** "Invitations" on /teams: accept (→ open the team) or decline. Hidden when there are none. */
export function InvitationsList({ invites, timeZone }: { invites: TeamInviteDTO[]; timeZone: string }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  if (invites.length === 0) return null;

  async function accept(invite: TeamInviteDTO) {
    const team = await run(
      () => apiFetch<TeamDetailDTO>(`/api/v1/me/invites/${invite.id}/accept`, { method: "POST" }),
      { success: `You joined ${invite.team.name}`, refresh: false },
    );
    if (team) {
      router.push(`/teams/${team.id}`);
      router.refresh();
    }
  }

  async function decline(invite: TeamInviteDTO) {
    await run(() => apiFetch(`/api/v1/me/invites/${invite.id}/decline`, { method: "POST" }), {
      success: "Invitation declined",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col divide-y divide-slate-100">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {invite.team.name} <span className="text-brand-700 text-sm">· {invite.team.courseCode}</span>
                </p>
                <p className="text-sm text-slate-600">
                  {invite.invitedBy.name} invited you · expires {formatDate(invite.expiresAt, timeZone)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => decline(invite)}
                  aria-label={`Decline invitation to ${invite.team.name}`}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => accept(invite)}
                  aria-label={`Accept invitation to ${invite.team.name}`}
                >
                  Accept
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

const STATUS: Record<JoinRequestDTO["status"], { label: string; tone: "neutral" | "success" | "danger" | "warning" }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** "My requests" on /teams: pending ones can be cancelled; recent decisions show their outcome. */
export function MyRequestsList({
  requests,
  timeZone,
  nowIso,
}: {
  requests: JoinRequestDTO[];
  timeZone: string;
  nowIso: string;
}) {
  const { run, pending } = useApiAction();
  const shown = requests.filter((r) => r.status !== "CANCELLED").slice(0, 8);
  if (shown.length === 0) return null;
  const now = new Date(nowIso);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My requests</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col divide-y divide-slate-100">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {r.team.name} <span className="text-brand-700 text-sm">· {r.team.courseCode}</span>
                </p>
                <p className="text-sm text-slate-600">
                  Sent {relativeTime(r.createdAt, now, timeZone)}
                  {r.decidedAt ? ` · answered ${relativeTime(r.decidedAt, now, timeZone)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                {r.status === "PENDING" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`Cancel request to join ${r.team.name}`}
                    onClick={() =>
                      run(() => apiFetch(`/api/v1/join-requests/${r.id}`, { method: "DELETE" }), {
                        success: "Request cancelled",
                      })
                    }
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
