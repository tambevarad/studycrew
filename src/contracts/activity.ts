/** PB-09 · FR-06 — Team activity history. Features WRITE via logActivity() in src/server/activity.ts. */
import { z } from "zod";
import { id, paginationQuery, type UserSummaryDTO } from "./common";

export const ACTIVITY_TYPES = [
  // teams (PB-04)
  "TEAM_CREATED",
  "TEAM_UPDATED",
  "INVITE_SENT",
  "JOIN_REQUESTED",
  "JOIN_APPROVED",
  "JOIN_DECLINED",
  "MEMBER_JOINED",
  "MEMBER_LEFT",
  "MEMBER_REMOVED",
  "MEMBER_ROLE_CHANGED",
  // tasks (PB-05)
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_MOVED",
  "TASK_ASSIGNED",
  "TASK_COMPLETED",
  "TASK_DELETED",
  // meetings (PB-06, PB-15)
  "MEETING_CREATED",
  "MEETING_UPDATED",
  "MEETING_CANCELLED",
  "MEETING_RSVP",
  "AGENDA_ITEM_ADDED",
  // resources (PB-07)
  "RESOURCE_ADDED",
  "RESOURCE_UPDATED",
  "RESOURCE_DELETED",
  // AI coverage (PB-10, PB-11)
  "COVERAGE_RUN",
  "COVERAGE_DELETED",
  "COVERAGE_TASK_CREATED",
  // milestones (PB-13)
  "MILESTONE_CREATED",
  "MILESTONE_UPDATED",
  "MILESTONE_DELETED",
  // polls (PB-14)
  "POLL_CREATED",
  "POLL_CLOSED",
] as const;
export type ActivityTypeValue = (typeof ACTIVITY_TYPES)[number];

export const ENTITY_TYPES = ["team", "member", "task", "meeting", "resource", "coverage", "milestone", "poll"] as const;
export type EntityTypeValue = (typeof ENTITY_TYPES)[number];

export const listActivityQuery = paginationQuery.extend({
  type: z.enum(ACTIVITY_TYPES).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  actorId: id.optional(),
});
export type ListActivityQuery = z.infer<typeof listActivityQuery>;

export interface ActivityDTO {
  id: string;
  teamId: string;
  type: ActivityTypeValue;
  entityType: EntityTypeValue;
  entityId: string | null;
  summary: string;
  actor: UserSummaryDTO | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
