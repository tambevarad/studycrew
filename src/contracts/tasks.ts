/** PB-05 · FR-04 — Task board. */
import { z } from "zod";
import { id, isoDateTime, type UserSummaryDTO } from "./common";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatusValue, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

export const createTaskInput = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(TASK_STATUSES).default("TODO"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  dueAt: isoDateTime.nullable().optional(),
  assigneeIds: z.array(id).max(10).default([]),
  milestoneId: id.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInput>;

export const updateTaskInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAt: isoDateTime.nullable().optional(),
  assigneeIds: z.array(id).max(10).optional(),
  milestoneId: id.nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;

/** Move a card: put it in `status` at zero-based `index` within that column. */
export const moveTaskInput = z.object({
  status: z.enum(TASK_STATUSES),
  index: z.number().int().min(0),
});
export type MoveTaskInput = z.infer<typeof moveTaskInput>;

export const listTasksQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: id.optional(),
  milestoneId: id.optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuery>;

export interface TaskDTO {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueAt: string | null;
  position: number;
  milestoneId: string | null;
  assignees: UserSummaryDTO[];
  createdBy: UserSummaryDTO;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** dueAt is in the past and status is not DONE. */
  isOverdue: boolean;
  /** Set when the task came from an AI Coverage Check suggestion (PB-11). */
  coverageItemId: string | null;
}
