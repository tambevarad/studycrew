import { Users } from "lucide-react";
import { JoinTeamButton } from "@/components/features/teams/join-team-button";
import { isTeamFull, seatsLabel } from "@/components/features/teams/team-utils";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getInvitePreview } from "@/server/services/teams/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Join a team" };

export default async function JoinPage({ params }: PageProps<"/join/[inviteCode]">) {
  const { inviteCode } = await params;
  const user = await requirePageUser();
  const preview = await getInvitePreview(inviteCode, user.id);

  if (!preview) {
    return (
      <>
        <PageHeader title="Join a team" />
        <EmptyState
          title="This invite link isn't valid"
          description="It may have been reset by the team's leader. Ask them for the current link, or search for the team by course."
          action={<LinkButton href="/teams">Find teams</LinkButton>}
        />
      </>
    );
  }

  const { team, alreadyMember } = preview;
  const full = isTeamFull(team.memberCount);
  return (
    <>
      <PageHeader title={`Join ${team.name}`} description="You were invited to this team." />
      <Card className="max-w-xl">
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-brand-700 text-sm font-medium">{team.courseCode}</p>
            <h2 className="text-lg font-semibold text-slate-900">{team.name}</h2>
            {team.description ? <p className="mt-1 text-sm text-slate-600">{team.description}</p> : null}
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
              <Users className="size-4" aria-hidden />
              {seatsLabel(team.memberCount)}
            </p>
          </div>
          {alreadyMember ? (
            <Alert tone="info" className="flex flex-wrap items-center justify-between gap-3">
              <span>You&apos;re already a member of this team.</span>
              <LinkButton href={`/teams/${team.id}`} size="sm">
                Open team
              </LinkButton>
            </Alert>
          ) : full ? (
            <Alert tone="warning">This team is full (8 members). Ask a leader to remove someone, then try the link again.</Alert>
          ) : (
            <div className="flex justify-end gap-2">
              <LinkButton href="/teams" variant="ghost">
                Not now
              </LinkButton>
              <JoinTeamButton inviteCode={inviteCode} teamName={team.name} />
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
