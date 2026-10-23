/** PB-08 · FR-05 — In-app notifications. Other features CREATE them via notify() in src/server/notifications.ts. */
import { z } from "zod";
import { id, paginationQuery } from "./common";

export const NOTIFICATION_TYPES = [
  "TEAM_INVITE",
  "JOIN_REQUEST",
  "JOIN_DECISION",
  "TASK_ASSIGNED",
  "TASK_DUE_SOON",
  "MEETING_SCHEDULED",
  "MEETING_UPDATED",
  "POLL_CREATED",
  "POLL_CLOSED",
] as const;
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];

/** Hours before dueAt at which TASK_DUE_SOON fires (FR-05: "due within 24 hours"). */
export const DUE_SOON_HOURS = 24;

export const listNotificationsQuery = paginationQuery.extend({
  unreadOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

export const markReadInput = z
  .object({ ids: z.array(id).max(100).optional(), all: z.boolean().optional() })
  .refine((v) => v.all === true || (v.ids && v.ids.length > 0), "Pass ids or all: true.");
export type MarkReadInput = z.infer<typeof markReadInput>;

export interface NotificationDTO {
  id: string;
  type: NotificationTypeValue;
  teamId: string | null;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountDTO {
  count: number;
}
