import { notFound } from "next/navigation";
import { TeamTabNav } from "@/components/app-shell/team-tab-nav";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { isMember } from "@/server/permissions";
import { requirePageUser } from "@/server/session";
import { getTeamHeader } from "@/server/shared/teams";

/**
 * Team frame (foundation-owned). Non-members never see team content (NFR-02):
 * they get a clear explanation and a way to ask to join instead of the page.
 */
export default async function TeamLayout({ children, params }: LayoutProps<"/teams/[teamId]">) {
  const { teamId } = await params;
  const user = await requirePageUser();
  const team = await getTeamHeader(teamId);
  if (!team) notFound();
  const member = await isMember(teamId, user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-slate-200">
        <p className="text-sm font-medium text-brand-700">{team.courseCode}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{team.name}</h1>
        {team.description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{team.description}</p> : null}
        {member ? <div className="mt-4"><TeamTabNav teamId={teamId} /></div> : <div className="h-4" />}
      </header>
      {member ? (
        children
      ) : (
        <Alert tone="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>You&apos;re not a member of {team.name}, so its board, calendar, and files are hidden.</span>
          {team.isOpen ? (
            <LinkButton href={`/teams?course=${encodeURIComponent(team.courseCode)}`} size="sm" variant="secondary">
              Ask to join
            </LinkButton>
          ) : null}
        </Alert>
      )}
    </div>
  );
}
