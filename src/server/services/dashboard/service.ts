/**
 * PB-12 · FR-06 — team dashboard and personal home. Reads only (tasks, meetings, milestones, members); writes nothing.
 * Reuses PB-05 `taskInclude`/`toTaskDTO`, PB-06 `listMeetings`/`meetingInclude`/`toMeetingDTO`, PB-13 `listMilestones`.
 */
import { percent } from "@/components/features/milestones/progress";
import type { TeamDashboardDTO } from "@/contracts/dashboard";
import type { MeetingDTO } from "@/contracts/meetings";
import type { TaskDTO } from "@/contracts/tasks";
import { db } from "@/server/db";
import { toUserSummary, userSummarySelect } from "@/server/mappers";
import { requireMembership } from "@/server/permissions";
import { listMeetings, meetingInclude, toMeetingDTO } from "@/server/services/meetings/service";
import { listMilestones } from "@/server/services/milestones/service";
import { taskInclude, toTaskDTO } from "@/server/services/tasks/service";
import { byDueSoonest, isDueSoonAt, isOverdueAt, workloadByMember } from "./rules";

export const UPCOMING_MEETINGS = 5;
/** How far ahead "next meetings" looks. */
const UPCOMING_WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

/**
 * AC1–AC3: completion %, overdue and due-soon tasks, the next meetings, milestone progress, and each member's open and
 * overdue counts. `now` is a parameter so tests can pin it.
 */
export async function getTeamDashboard(
  teamId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<TeamDashboardDTO> {
  await requireMembership(teamId, actorId);
  const [rows, memberRows, meetings, milestones] = await Promise.all([
    db.task.findMany({ where: { teamId }, include: taskInclude }),
    db.teamMember.findMany({ where: { teamId }, select: { user: { select: userSummarySelect } } }),
    listMeetings(teamId, actorId, {
      from: now.toISOString(),
      to: new Date(now.getTime() + UPCOMING_WINDOW_DAYS * DAY_MS).toISOString(),
    }),
    listMilestones(teamId, actorId),
  ]);
  const tasks = rows.map((r) => toTaskDTO(r, now));
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  return {
    teamId,
    totalTasks: tasks.length,
    doneTasks,
    completionPercent: percent(doneTasks, tasks.length),
    overdueTasks: tasks.filter((t) => isOverdueAt(t, now)).sort(byDueSoonest),
    dueSoonTasks: tasks.filter((t) => isDueSoonAt(t, now)).sort(byDueSoonest),
    upcomingMeetings: meetings.slice(0, UPCOMING_MEETINGS),
    milestones,
    openTasksPerMember: workloadByMember(
      memberRows.map((m) => toUserSummary(m.user)),
      tasks,
      now,
    ),
  };
}

/** AC5: tasks assigned to me that aren't Done, in every team I'm still on, soonest due first. */
export async function listMyOpenTasks(userId: string, now: Date = new Date()): Promise<TaskDTO[]> {
  const rows = await db.task.findMany({
    where: {
      status: { not: "DONE" },
      assignees: { some: { userId } },
      team: { members: { some: { userId } } },
    },
    include: taskInclude,
  });
  return rows.map((r) => toTaskDTO(r, now)).sort(byDueSoonest);
}

/** My next meetings across all my teams (not yet ended), soonest first. */
export async function listMyUpcomingMeetings(
  userId: string,
  now: Date = new Date(),
  limit = UPCOMING_MEETINGS,
): Promise<MeetingDTO[]> {
  const rows = await db.meeting.findMany({
    where: { endsAt: { gt: now }, team: { members: { some: { userId } } } },
    include: meetingInclude,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map((r) => toMeetingDTO(r, userId));
}
