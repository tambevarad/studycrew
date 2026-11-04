import { formatWhen } from "@/components/features/meetings/format";
import { PollsView } from "@/components/features/polls/polls-view";
import { canClosePoll, listPolls } from "@/server/services/polls/service";
import { myRoleIn } from "@/server/services/teams/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Polls" };

export default async function PollsPage({ params }: PageProps<"/teams/[teamId]/polls">) {
  const { teamId } = await params;
  const user = await requirePageUser(); // the team layout already blocked non-members
  const now = new Date();
  const [polls, role] = await Promise.all([listPolls(teamId, user.id, now), myRoleIn(teamId, user.id)]);
  const isLeader = role === "LEADER";
  // Absolute times are formatted here, on the server, with the parts-based helper (no Intl in client render).
  const closesLabels = Object.fromEntries(polls.map((p) => [p.id, formatWhen(new Date(p.closesAt), user.timezone)]));
  return (
    <PollsView
      teamId={teamId}
      polls={polls}
      closableIds={polls.filter((p) => canClosePoll(p, user.id, isLeader)).map((p) => p.id)}
      closesLabels={closesLabels}
      timeZone={user.timezone}
      nowIso={now.toISOString()}
    />
  );
}
