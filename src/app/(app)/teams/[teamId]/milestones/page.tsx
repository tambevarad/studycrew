import { MilestonesView } from "@/components/features/milestones/milestones-view";
import { requirePageUser } from "@/server/session";
import { listMilestones } from "@/server/services/milestones/service";
import { listTasks } from "@/server/services/tasks/service";

export const metadata = { title: "Milestones" };

/** PB-13 · FR-08 — milestones from templates or by hand, linked tasks, and progress. */
export default async function MilestonesPage({ params }: PageProps<"/teams/[teamId]/milestones">) {
  const { teamId } = await params;
  const user = await requirePageUser();
  const [milestones, tasks] = await Promise.all([listMilestones(teamId, user.id), listTasks(teamId, user.id, {})]);

  return (
    <MilestonesView
      teamId={teamId}
      milestones={milestones}
      tasks={tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, milestoneId: t.milestoneId }))}
      timeZone={user.timezone}
      nowIso={new Date().toISOString()}
    />
  );
}
