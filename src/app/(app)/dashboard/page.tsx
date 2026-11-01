import { Mail } from "lucide-react";
import Link from "next/link";
import { MeetingLinks, Panel, TaskLinks } from "@/components/features/dashboard/sections";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { pluralize } from "@/lib/utils";
import { requirePageUser } from "@/server/session";
import { listMyOpenTasks, listMyUpcomingMeetings } from "@/server/services/dashboard/service";
import { listMyInvites } from "@/server/services/teams/service";
import { listMyTeams } from "@/server/shared/teams";

export const metadata = { title: "Home" };

/** PB-12 — personal home: my open tasks across teams, my next meetings, pending invites, my teams. */
export default async function DashboardPage() {
  const user = await requirePageUser();
  const now = new Date();
  const [teams, invites, myTasks, myMeetings] = await Promise.all([
    listMyTeams(user.id),
    listMyInvites(user.id, now),
    listMyOpenTasks(user.id, now),
    listMyUpcomingMeetings(user.id, now),
  ]);
  const teamNames = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Your tasks, meetings, and teams at a glance."
        actions={<LinkButton href="/teams/new">Create a team</LinkButton>}
      />

      {invites.length > 0 ? (
        <Alert tone="info" className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Mail aria-hidden className="size-4" />
            You have {pluralize(invites.length, "pending team invitation")}.
          </span>
          <LinkButton href="/teams" size="sm" variant="secondary">
            Review invitations
          </LinkButton>
        </Alert>
      ) : null}

      {teams.length === 0 ? (
        <EmptyState
          title="You're not on a team yet"
          description="Create a team for your course, or search for one and ask to join."
          action={<LinkButton href="/teams">Find a team</LinkButton>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel id="my-tasks-heading" level={2} title={`My tasks (${myTasks.length})`}>
              <TaskLinks
                tasks={myTasks}
                now={now}
                timeZone={user.timezone}
                teamNames={teamNames}
                empty="Nothing assigned to you right now. Pick something up on your team's board."
              />
            </Panel>
            <Panel id="my-meetings-heading" level={2} title="My next meetings">
              <MeetingLinks
                meetings={myMeetings}
                timeZone={user.timezone}
                teamNames={teamNames}
                empty="No meetings coming up. Use Find a time on a team's calendar."
              />
            </Panel>
          </div>

          <section aria-labelledby="my-teams-heading" className="flex flex-col gap-3">
            <h2 id="my-teams-heading" className="text-lg font-semibold text-slate-900">
              My teams
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => (
                <li key={t.id}>
                  <Link href={`/teams/${t.id}`} className="block rounded-lg focus-visible:outline-2">
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardBody className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">{t.name}</span>
                          {t.role === "LEADER" ? <Badge tone="brand">Leader</Badge> : null}
                        </div>
                        <span className="text-sm text-slate-600">
                          {t.courseCode} · {pluralize(t.memberCount, "member")}
                        </span>
                      </CardBody>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
