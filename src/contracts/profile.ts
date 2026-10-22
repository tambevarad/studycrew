/** PB-02 · FR-01 — Accounts and profiles. */
import { z } from "zod";
import { courseCode, timeZone } from "./common";

export const updateProfileInput = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80).optional(),
  timezone: timeZone.optional(),
  courses: z.array(courseCode).max(12, "Add at most 12 courses.").optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20, "Add at most 20 skills.").optional(),
  bio: z.string().trim().max(500).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;

export interface ProfileDTO {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  courses: string[];
  skills: string[];
  bio: string | null;
  createdAt: string;
}
