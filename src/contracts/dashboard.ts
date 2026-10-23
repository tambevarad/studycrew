/** PB-12 · FR-06 — Team dashboard. */
import type { UserSummaryDTO } from "./common";
import type { MeetingDTO } from "./meetings";
import type { MilestoneDTO } from "./milestones";
import type { TaskDTO } from "./tasks";

export interface TeamDashboardDTO {
  teamId: string;
  totalTasks: number;
  doneTasks: number;
  /** round(doneTasks / totalTasks * 100); 0 when there are no tasks. */
  completionPercent: number;
  overdueTasks: TaskDTO[];
  dueSoonTasks: TaskDTO[];
  upcomingMeetings: MeetingDTO[];
  milestones: MilestoneDTO[];
  openTasksPerMember: Array<{ user: UserSummaryDTO; open: number; overdue: number }>;
}
