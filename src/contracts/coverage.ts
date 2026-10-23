/** PB-10, PB-11, PB-16 · FR-07 — AI Coverage Check. */
import { z } from "zod";
import { id, isoDateTime, type UserSummaryDTO } from "./common";

export const WORK_TYPES = ["ASSIGNMENT", "PRESENTATION", "REPORT", "EXAM_PREP"] as const;
export type WorkTypeValue = (typeof WORK_TYPES)[number];
export const WORK_TYPE_LABELS: Record<WorkTypeValue, string> = {
  ASSIGNMENT: "Assignment",
  PRESENTATION: "Presentation",
  REPORT: "Report",
  EXAM_PREP: "Exam prep",
};

export const COVERAGE_STATUSES = ["COVERED", "PARTIAL", "MISSING"] as const;
export type CoverageStatusValue = (typeof COVERAGE_STATUSES)[number];

export const MAX_INSTRUCTIONS_CHARS = 15_000;
export const MAX_DRAFT_CHARS = 30_000;
export const MAX_RUNS_PER_USER_PER_DAY = 10;
/** p95 budget from NFR-01/NFR-05. Abort the provider call after this. */
export const AI_TIMEOUT_MS = 30_000;

export const runCoverageInput = z.object({
  title: z.string().trim().min(1, "Give this check a title.").max(120),
  workType: z.enum(WORK_TYPES),
  instructions: z
    .string()
    .trim()
    .min(1, "Paste the assignment instructions or topic list.")
    .max(MAX_INSTRUCTIONS_CHARS, `Instructions can be at most ${MAX_INSTRUCTIONS_CHARS.toLocaleString()} characters.`),
  draft: z
    .string()
    .trim()
    .min(1, "Paste your team's draft, outline, or notes.")
    .max(MAX_DRAFT_CHARS, `The draft can be at most ${MAX_DRAFT_CHARS.toLocaleString()} characters.`),
  /** NFR-02: text goes to a third-party AI only after explicit consent on each run. */
  consent: z.literal(true, "Please confirm you agree to send this text to the AI provider."),
});
export type RunCoverageInput = z.infer<typeof runCoverageInput>;

/** PB-11 */
export const createTaskFromItemInput = z.object({
  assigneeIds: z.array(id).max(10).default([]),
  dueAt: isoDateTime.nullable().optional(),
});
export type CreateTaskFromItemInput = z.infer<typeof createTaskFromItemInput>;

/** PB-11 */
export const rateItemInput = z.object({ rating: z.enum(["HELPFUL", "NOT_HELPFUL"]) });
export type RateItemInput = z.infer<typeof rateItemInput>;

export interface CoverageItemDTO {
  id: string;
  position: number;
  requirement: string;
  status: CoverageStatusValue;
  evidenceQuote: string | null;
  evidenceVerified: boolean;
  reason: string;
  suggestion: string | null;
  taskId: string | null;
  rating: "HELPFUL" | "NOT_HELPFUL" | null;
}

export interface CoverageReportSummaryDTO {
  id: string;
  teamId: string;
  title: string;
  workType: WorkTypeValue;
  status: "COMPLETED" | "FAILED";
  score: number | null;
  counts: Record<CoverageStatusValue, number>;
  author: UserSummaryDTO;
  provider: string;
  model: string;
  createdAt: string;
}

export interface CoverageReportDTO extends CoverageReportSummaryDTO {
  instructions: string;
  draft: string;
  errorMessage: string | null;
  promptVersion: string;
  latencyMs: number;
  items: CoverageItemDTO[];
  /** Author or team leader may permanently delete (NFR-02). */
  canDelete: boolean;
}
