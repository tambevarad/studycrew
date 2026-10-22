/**
 * PB-03 · FR-01 — Weekly availability grid.
 *
 * Slot encoding (shared with PB-06 meeting finder):
 *   slot = day * SLOTS_PER_DAY + halfHour
 *   day 0 = Monday … 6 = Sunday; halfHour 0 = 00:00–00:30 … 47 = 23:30–24:00
 *   interpreted in the owning user's timezone (User.timezone).
 */
import { z } from "zod";
import type { UserSummaryDTO } from "./common";

export const DAYS_PER_WEEK = 7;
export const SLOTS_PER_DAY = 48;
export const TOTAL_SLOTS = DAYS_PER_WEEK * SLOTS_PER_DAY; // 336
export const SLOT_MINUTES = 30;
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const updateAvailabilityInput = z.object({
  slots: z.array(z.number().int().min(0).max(TOTAL_SLOTS - 1)).max(TOTAL_SLOTS),
});
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilityInput>;

export interface AvailabilityDTO {
  userId: string;
  timezone: string;
  /** Sorted, unique slot indexes. */
  slots: number[];
  updatedAt: string | null;
}

export interface TeamAvailabilityDTO {
  teamId: string;
  members: Array<{ user: UserSummaryDTO; timezone: string; slots: number[] }>;
}

export function slotOf(day: number, halfHour: number): number {
  return day * SLOTS_PER_DAY + halfHour;
}

export function dayAndHalfHour(slot: number): { day: number; halfHour: number } {
  return { day: Math.floor(slot / SLOTS_PER_DAY), halfHour: slot % SLOTS_PER_DAY };
}
