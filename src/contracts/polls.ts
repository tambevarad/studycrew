/** PB-14 · FR-09 — Group polls. */
import { z } from "zod";
import { id, isoDateTime, type UserSummaryDTO } from "./common";

export const createPollInput = z.object({
  question: z.string().trim().min(1, "Ask a question.").max(200),
  options: z
    .array(z.string().trim().min(1).max(100))
    .min(2, "Add at least 2 options.")
    .max(6, "Add at most 6 options.")
    .refine((o) => new Set(o.map((s) => s.toLowerCase())).size === o.length, "Options must be different."),
  closesAt: isoDateTime,
});
export type CreatePollInput = z.infer<typeof createPollInput>;

export const voteInput = z.object({ optionId: id });
export type VoteInput = z.infer<typeof voteInput>;

export interface PollDTO {
  id: string;
  teamId: string;
  question: string;
  closesAt: string;
  isClosed: boolean;
  createdBy: UserSummaryDTO;
  options: Array<{ id: string; label: string; votes: number }>;
  myVoteOptionId: string | null;
  totalVotes: number;
  /** Set once closed. Ties go to the option listed first. */
  winningOptionId: string | null;
  createdAt: string;
}
