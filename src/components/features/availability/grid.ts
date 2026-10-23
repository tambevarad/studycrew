/**
 * Pure helpers for the weekly availability grid (PB-03). Lives with the UI because the painting, copy, and summary
 * logic runs in the browser; the service only de-duplicates and sorts.
 * Slots use the shared encoding from `contracts/availability.ts`: slot = day * 48 + halfHour.
 */
import { DAY_LABELS, dayAndHalfHour, SLOTS_PER_DAY, slotOf } from "@/contracts/availability";

export type PaintMode = "add" | "remove";

const sortUnique = (slots: Iterable<number>) => [...new Set(slots)].sort((a, b) => a - b);

/** Adds or removes every slot in the rectangle spanned by two corners (all days between, all half-hours between). */
export function toggleRange(slots: readonly number[], fromSlot: number, toSlot: number, mode: PaintMode): number[] {
  const a = dayAndHalfHour(fromSlot);
  const b = dayAndHalfHour(toSlot);
  const set = new Set(slots);
  for (let day = Math.min(a.day, b.day); day <= Math.max(a.day, b.day); day++) {
    for (let hh = Math.min(a.halfHour, b.halfHour); hh <= Math.max(a.halfHour, b.halfHour); hh++) {
      if (mode === "add") set.add(slotOf(day, hh));
      else set.delete(slotOf(day, hh));
    }
  }
  return sortUnique(set);
}

/** "HH:MM" for a half-hour boundary 0…48 (48 → "24:00"). */
export function boundaryTime(halfHour: number): string {
  const h = Math.floor(halfHour / 2);
  return `${String(h).padStart(2, "0")}:${halfHour % 2 ? "30" : "00"}`;
}

/** Contiguous runs per day: `[{ day: 0, start: "18:00", end: "22:00" }]`. A run reaching midnight ends at "24:00". */
export function slotsToRanges(slots: readonly number[]): { day: number; start: string; end: string }[] {
  const sorted = sortUnique(slots);
  const out: { day: number; start: string; end: string }[] = [];
  let i = 0;
  while (i < sorted.length) {
    const { day, halfHour: first } = dayAndHalfHour(sorted[i]);
    let last = first;
    while (i + 1 < sorted.length && sorted[i + 1] === slotOf(day, last + 1) && last + 1 < SLOTS_PER_DAY) {
      i++;
      last++;
    }
    out.push({ day, start: boundaryTime(first), end: boundaryTime(last + 1) });
    i++;
  }
  return out;
}

/** Replaces each target day's slots with the source day's pattern. */
export function copyDay(slots: readonly number[], fromDay: number, toDays: readonly number[]): number[] {
  const pattern = slots.filter((s) => dayAndHalfHour(s).day === fromDay).map((s) => dayAndHalfHour(s).halfHour);
  const targets = new Set(toDays.filter((d) => d !== fromDay));
  const kept = slots.filter((s) => !targets.has(dayAndHalfHour(s).day));
  return sortUnique([...kept, ...[...targets].flatMap((d) => pattern.map((hh) => slotOf(d, hh)))]);
}

/** "18:00" → "6:00 PM"; "24:00" → "12:00 AM". */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h % 24;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(m).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** Human summary for screen readers and the text equivalent of the grid: "Mon 6:00 PM–10:00 PM". */
export function formatRange(r: { day: number; start: string; end: string }): string {
  return `${DAY_LABELS[r.day]} ${to12h(r.start)}–${to12h(r.end)}`;
}

/** Number of cells that differ between two slot lists (for the "N unsaved changes" bar). */
export function countChanged(a: readonly number[], b: readonly number[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let n = 0;
  for (const s of sa) if (!sb.has(s)) n++;
  for (const s of sb) if (!sa.has(s)) n++;
  return n;
}

/** Preset: Monday–Friday 6:00–10:00 PM, added to what's already there. */
export function weekdayEvenings(slots: readonly number[]): number[] {
  let next = [...slots];
  for (let day = 0; day < 5; day++) next = toggleRange(next, slotOf(day, 36), slotOf(day, 43), "add");
  return next;
}
