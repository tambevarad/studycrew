import Link from "next/link";
import { Suspense } from "react";
import { RecentActivity } from "@/components/features/activity/recent-activity";
import { CompletionDonut } from "@/components/features/dashboard/completion-donut";
import { MeetingLinks, MilestoneProgress, Panel, StatTile, TaskLinks } from "@/components/features/dashboard/sections";
import { WorkloadChart } from "@/components/features/dashboard/workload-chart";
import { formatDayShort, formatTimeRange } from "@/components/features/meetings/format";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import type { TeamDashboardDTO } from "@/contracts/dashboard";
import { AppError } from "@/server/errors";
import { requirePageUser } from "@/server/session";
import { getTeamDashboard } from "@/server/services/dashboard/service";

export const metadata = { title: "Team overview" };

/** PB-12 · FR-06 — team overview: progress, deadlines, meetings, milestones, workload, recent activity. */
export default async function TeamOverviewPage({ params }: PageProps<"/teams/[teamId]">) {
  const { teamId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Overview" description="Progress, deadlines, meetings, and who's working on what." />
      {/* Loading state here rather than in `[teamId]/loading.tsx`, which would wrap every team tab. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview teamId={teamId} />
      </Suspense>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the team overview">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

async function Overview({ teamId }: { teamId: string }) {
  const user = await requirePageUser();
  const now = new Date();
  const base = `/teams/${teamId}`;
  let d: TeamDashboardDTO;
  try {
    d = await getTeamDashboard(teamId, user.id, now);
  } catch (err) {
    // The team layout already shows non-members (and missing teams) the right message instead of this page.
    if (err instanceof AppError && (err.code === "FORBIDDEN" || err.code === "NOT_FOUND")) return null;
    // Error state (UI guidelines §6): a message and a retry instead of a blank page.
    console.error("[dashboard] team overview failed", err);
    return (
      <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
        <span>We couldn&apos;t load the team overview. Check your connection, then try again.</span>
        <LinkButton href={base} variant="outline" size="sm">
          Try again
        </LinkButton>
      </Alert>
    );
  }
  const tz = user.timezone;
  const open = d.totalTasks - d.doneTasks;
  const next = d.upcomingMeetings[0];

  return (
    <>
      {d.totalTasks === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add tasks on the Board to see progress here: completion, overdue work, and who's working on what."
          action={<LinkButton href={`${base}/board`}>Go to the board</LinkButton>}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          testId="tile-completion"
          label="Completion"
          detail={d.totalTasks === 0 ? "No tasks yet" : `${d.doneTasks} of ${d.totalTasks} tasks done`}
        >
          <CompletionDonut percent={d.completionPercent} done={d.doneTasks} total={d.totalTasks} />
        </StatTile>
        <StatTile testId="tile-open" label="Open tasks" value={open} detail="Not done yet" />
        <StatTile
          testId="tile-overdue"
          label="Overdue"
          value={d.overdueTasks.length}
          tone={d.overdueTasks.length > 0 ? "danger" : "neutral"}
          detail={d.overdueTasks.length > 0 ? "Past their due date" : "Nothing overdue"}
        />
        <StatTile
          testId="tile-next-meeting"
          label="Next meeting"
          detail={
            next ? (
              <>
                <Link href={`${base}/calendar/${next.id}`} className="text-brand-700 font-medium hover:underline">
                  {next.title}
                </Link>
                <span className="block text-slate-600">
                  {formatDayShort(new Date(next.startsAt), tz)} ·{" "}
                  {formatTimeRange(new Date(next.startsAt), new Date(next.endsAt), tz)}
                </span>
              </>
            ) : (
              <>
                None scheduled.{" "}
                <Link href={`${base}/calendar`} className="text-brand-700 font-medium hover:underline">
                  Find a time
                </Link>
              </>
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="overdue-heading" title={`Overdue (${d.overdueTasks.length})`}>
          <TaskLinks tasks={d.overdueTasks} now={now} timeZone={tz} empty="Nothing overdue. Nice work." />
        </Panel>
        <Panel id="due-soon-heading" title={`Due in the next 24 hours (${d.dueSoonTasks.length})`}>
          <TaskLinks tasks={d.dueSoonTasks} now={now} timeZone={tz} empty="Nothing due in the next 24 hours." />
        </Panel>
        <Panel id="workload-heading" title="Open tasks per member">
          <WorkloadChart rows={d.openTasksPerMember} />
        </Panel>
        <Panel
          id="meetings-heading"
          title="Upcoming meetings"
          action={
            <LinkButton href={`${base}/calendar`} variant="ghost" size="sm">
              Calendar
            </LinkButton>
          }
        >
          <MeetingLinks
            meetings={d.upcomingMeetings}
            timeZone={tz}
            empty="No meetings coming up. Use Find a time on the calendar."
          />
        </Panel>
        <Panel
          id="milestones-heading"
          title="Milestones"
          action={
            <LinkButton href={`${base}/milestones`} variant="ghost" size="sm">
              Milestones
            </LinkButton>
          }
        >
          {d.milestones.length === 0 ? (
            <p className="text-sm text-slate-600">No milestones yet. Start from a template on the Milestones tab.</p>
          ) : (
            <MilestoneProgress milestones={d.milestones} timeZone={tz} />
          )}
        </Panel>
        <Panel id="activity-heading" title="Recent activity">
          <RecentActivity teamId={teamId} limit={5} />
        </Panel>
      </div>
    </>
  );
}
