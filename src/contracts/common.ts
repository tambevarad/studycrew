/**
 * Shared primitives for every contract file. FROZEN: change via a "Contract change" issue.
 *
 * Rules every contract follows:
 * - Inputs are Zod schemas named `<verb><Thing>Input` (bodies) or `<thing>Query` (search params).
 * - Outputs are plain TypeScript interfaces named `<Thing>DTO`.
 * - All timestamps in DTOs are ISO 8601 strings in UTC (`toISOString()`), never Date objects,
 *   so the same DTO works for Server Components and JSON responses.
 */
import { z } from "zod";

export const id = z.string().min(1).max(64);

/** ISO 8601 date-time with an offset or Z, e.g. "2026-10-24T15:00:00.000Z". */
export const isoDateTime = z.iso.datetime({ offset: true });

/** Calendar date "YYYY-MM-DD". */
export const isoDate = z.iso.date();

/** "cse6324", "CSE-6324", " cse  6324 " → "CSE 6324". */
export function normalizeCourseCode(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/[\s_-]+/g, "");
  const match = compact.match(/^([A-Z]+)(\d+[A-Z]?)$/);
  return match ? `${match[1]} ${match[2]}` : raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export const courseCode = z
  .string()
  .trim()
  .min(2, "Enter a course code like CSE 6324.")
  .max(20, "Course codes are at most 20 characters.")
  .transform(normalizeCourseCode);

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timeZone = z.string().refine(isValidTimeZone, "Choose a valid time zone.");

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export interface Page<T> {
  items: T[];
  /** Pass back as `cursor` to get the next page; null when there are no more. */
  nextCursor: string | null;
}

/** The public face of a user wherever another user can see them. Never includes timezone/bio. */
export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Successful API response envelope. Errors use ApiErrorBody from src/server/errors.ts. */
export interface ApiSuccess<T> {
  data: T;
}
