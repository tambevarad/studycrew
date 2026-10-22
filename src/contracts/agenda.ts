/** PB-15 · FR-10 — Meeting agenda and help-needed topics. */
import { z } from "zod";
import type { UserSummaryDTO } from "./common";

export const createAgendaItemInput = z.object({
  title: z.string().trim().min(1, "Add a topic.").max(200),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateAgendaItemInput = z.infer<typeof createAgendaItemInput>;

export const helpFlagInput = z.object({ needsHelp: z.boolean() });

export interface AgendaItemDTO {
  id: string;
  meetingId: string;
  title: string;
  notes: string | null;
  author: UserSummaryDTO;
  helpCount: number;
  flaggedByMe: boolean;
  createdAt: string;
}
