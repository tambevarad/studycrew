import { TaskBoard } from "@/components/features/tasks/task-board";
import { listAssignableMembers, listMilestoneOptions, listTasks } from "@/server/services/tasks/service";
import { requirePageUser } from "@/server/session";

export const metadata = { title: "Task board" };

export default async function BoardPage({ params, searchParams }: PageProps<"/teams/[teamId]/board">) {
  const { teamId } = await params;
  const { task } = await searchParams;
  const user = await requirePageUser(); // the team layout already blocked non-members
  const [tasks, members, milestones] = await Promise.all([
    listTasks(teamId, user.id, {}),
    listAssignableMembers(teamId, user.id),
    listMilestoneOptions(teamId, user.id),
  ]);
  return (
    <TaskBoard
      teamId={teamId}
      initialTasks={tasks}
      members={members}
      milestones={milestones}
      meId={user.id}
      timeZone={user.timezone}
      nowIso={new Date().toISOString()}
      initialTaskId={typeof task === "string" ? task : null}
    />
  );
}
