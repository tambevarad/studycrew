/**
 * Pure helpers for profile lists (PB-02). No database access, so they are unit-tested directly.
 */
import { normalizeCourseCode } from "@/contracts/common";

/** Normalizes each course ("cse6324" → "CSE 6324") and drops repeats, keeping the first occurrence's position. */
export function dedupeCourses(courses: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of courses) {
    const code = normalizeCourseCode(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** Trims each skill and drops case-insensitive repeats ("react", "React "), keeping the first spelling and order. */
export function dedupeSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const skill = raw.trim().replace(/\s+/g, " ");
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}
