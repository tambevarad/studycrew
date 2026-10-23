/**
 * Pure rules for the chip inputs on the profile page (PB-02). Mirrors the server's de-duplication so the user sees
 * the final value before saving; the server stays the source of truth.
 */
import { normalizeCourseCode } from "@/contracts/common";

export interface ChipRules {
  /** What one chip is called in messages, e.g. "course". */
  noun: string;
  max: number;
  maxLength: number;
  minLength?: number;
  normalize: (raw: string) => string;
  /** Key used to detect repeats (case-insensitive for skills). */
  key: (value: string) => string;
}

export const COURSE_RULES: ChipRules = {
  noun: "course",
  max: 12,
  maxLength: 20,
  minLength: 2,
  normalize: normalizeCourseCode,
  key: (v) => v,
};

export const SKILL_RULES: ChipRules = {
  noun: "skill",
  max: 20,
  maxLength: 40,
  normalize: (raw) => raw.trim().replace(/\s+/g, " "),
  key: (v) => v.toLowerCase(),
};

export type AddChipResult = { ok: true; values: string[]; added: string } | { ok: false; error: string };

/** Adds one typed value to the list, or explains (in user terms) why it can't be added. */
export function addChip(values: readonly string[], raw: string, rules: ChipRules): AddChipResult {
  if (!raw.trim()) return { ok: false, error: `Type a ${rules.noun} first.` };
  const value = rules.normalize(raw);
  if (rules.minLength && value.replace(/\s/g, "").length < rules.minLength) {
    return { ok: false, error: `That ${rules.noun} is too short.` };
  }
  if (value.length > rules.maxLength) {
    return { ok: false, error: `Each ${rules.noun} can be at most ${rules.maxLength} characters.` };
  }
  if (values.some((v) => rules.key(v) === rules.key(value))) {
    return { ok: false, error: `“${value}” is already in your list.` };
  }
  if (values.length >= rules.max) {
    return { ok: false, error: `You can add at most ${rules.max} ${rules.noun}s. Remove one first.` };
  }
  return { ok: true, values: [...values, value], added: value };
}
