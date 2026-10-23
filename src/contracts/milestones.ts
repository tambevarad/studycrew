/** PB-13 · FR-08 — Milestones and templates. */
import { z } from "zod";
import { id, isoDateTime } from "./common";

export const MILESTONE_TEMPLATES = {
  presentation: {
    label: "Presentation",
    milestones: ["Pick topic and split sections", "Research and sources", "Draft slides", "Rehearsal", "Final slides submitted"],
  },
  report: {
    label: "Written report",
    milestones: ["Outline agreed", "First draft", "Peer review", "Final edit and citations", "Submitted"],
  },
  "exam-prep": {
    label: "Exam prep",
    milestones: ["Topic list split", "Summary notes", "Practice questions", "Group review session"],
  },
  assignment: {
    label: "Group assignment",
    milestones: ["Read and split requirements", "First pass complete", "Integrate and check", "Submitted"],
  },
} as const;
export type MilestoneTemplateKey = keyof typeof MILESTONE_TEMPLATES;

export const createMilestoneInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  dueAt: isoDateTime.nullable().optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneInput>;

export const updateMilestoneInput = createMilestoneInput.partial();
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInput>;

export const applyTemplateInput = z.object({
  templateKey: z.enum(Object.keys(MILESTONE_TEMPLATES) as [MilestoneTemplateKey, ...MilestoneTemplateKey[]]),
  /** Final due date; earlier milestones are spread evenly from today to this date. */
  finalDueAt: isoDateTime,
});
export type ApplyTemplateInput = z.infer<typeof applyTemplateInput>;

export const linkTaskInput = z.object({ taskId: id });

export interface MilestoneDTO {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  templateKey: string | null;
  position: number;
  taskCount: number;
  doneCount: number;
  /** round(doneCount / taskCount * 100); 0 when there are no tasks. */
  percent: number;
}
