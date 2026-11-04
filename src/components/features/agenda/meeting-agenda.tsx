import { requireMembership } from "@/server/permissions";
import { requirePageUser } from "@/server/session";
import { listAgenda } from "@/server/services/agenda/service";
import { AgendaCard } from "./agenda-card";

/** PB-15 · FR-10 — rendered by PB-06's meeting page. Loads the topics here and hands them to the client card. */
export async function MeetingAgenda({ teamId, meetingId }: { teamId: string; meetingId: string }) {
  const user = await requirePageUser();
  const [items, membership] = await Promise.all([
    listAgenda(teamId, user.id, meetingId),
    requireMembership(teamId, user.id),
  ]);
  return (
    <AgendaCard
      teamId={teamId}
      meetingId={meetingId}
      items={items}
      me={{ id: user.id, isLeader: membership.role === "LEADER" }}
    />
  );
}
