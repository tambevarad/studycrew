import { MembersView } from "@/components/features/teams/members-view";
import { getTeam, listJoinRequests } from "@/server/services/teams/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Members" };

export default async function MembersPage({ params, searchParams }: PageProps<"/teams/[teamId]/members">) {
  const { teamId } = await params;
  const { created } = await searchParams;
  const user = await requirePageUser(); // the team layout already blocked non-members
  const team = await getTeam(teamId, user.id);
  const joinRequests = team.myRole === "LEADER" ? await listJoinRequests(teamId, user.id) : [];
  return (
    <MembersView
      team={team}
      joinRequests={joinRequests}
      meId={user.id}
      justCreated={created === "1"}
      timeZone={user.timezone}
      nowIso={new Date().toISOString()}
    />
  );
}
