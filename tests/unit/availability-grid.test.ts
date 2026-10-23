import { describe, expect, it } from "vitest";
import {
  copyDay,
  countChanged,
  formatRange,
  slotsToRanges,
  to12h,
  toggleRange,
  weekdayEvenings,
} from "@/components/features/availability/grid";
import { slotOf } from "@/contracts/availability";

describe("PB-03 toggleRange", () => {
  it("AC1: Mon 18:00 → Wed 21:30 paints 3 days × 8 half-hours = 24 slots", () => {
    const slots = toggleRange([], slotOf(0, 36), slotOf(2, 43), "add");
    expect(slots).toHaveLength(24);
    expect(slots[0]).toBe(slotOf(0, 36));
    expect(slots[slots.length - 1]).toBe(slotOf(2, 43));
    expect(slots).not.toContain(slotOf(0, 44));
  });

  it("works with the corners in any order and on a single cell", () => {
    expect(toggleRange([], slotOf(2, 43), slotOf(0, 36), "add")).toEqual(
      toggleRange([], slotOf(0, 36), slotOf(2, 43), "add"),
    );
    expect(toggleRange([], slotOf(6, 47), slotOf(6, 47), "add")).toEqual([335]);
  });

  it("AC2: remove mode clears only the rectangle", () => {
    const full = toggleRange([], slotOf(0, 0), slotOf(1, 47), "add");
    const after = toggleRange(full, slotOf(0, 10), slotOf(1, 11), "remove");
    expect(after).toHaveLength(96 - 4);
    expect(after).not.toContain(slotOf(1, 10));
    expect(after).toContain(slotOf(1, 12));
  });
});

describe("PB-03 slotsToRanges", () => {
  it("joins contiguous half-hours per day and never across days", () => {
    const slots = [slotOf(0, 36), slotOf(0, 37), slotOf(0, 38), slotOf(0, 40), slotOf(0, 47), slotOf(1, 0)];
    expect(slotsToRanges(slots)).toEqual([
      { day: 0, start: "18:00", end: "19:30" },
      { day: 0, start: "20:00", end: "20:30" },
      { day: 0, start: "23:30", end: "24:00" },
      { day: 1, start: "00:00", end: "00:30" },
    ]);
  });

  it("handles a range ending at 24:00 and formats it for people", () => {
    const [r] = slotsToRanges(toggleRange([], slotOf(5, 44), slotOf(5, 47), "add"));
    expect(r).toEqual({ day: 5, start: "22:00", end: "24:00" });
    expect(formatRange(r)).toBe("Sat 10:00 PM–12:00 AM");
    expect(to12h("00:30")).toBe("12:30 AM");
    expect(to12h("12:00")).toBe("12:00 PM");
    expect(slotsToRanges([])).toEqual([]);
  });
});

describe("PB-03 copyDay, presets, change count", () => {
  it("copies Monday onto weekdays, replacing what was there", () => {
    const mon = toggleRange([], slotOf(0, 36), slotOf(0, 39), "add");
    const withTue = [...mon, slotOf(1, 10), slotOf(5, 20)];
    const copied = copyDay(withTue, 0, [1, 2, 3, 4]);
    expect(copied).not.toContain(slotOf(1, 10));
    expect(copied).toContain(slotOf(4, 39));
    expect(copied).toContain(slotOf(5, 20)); // Saturday untouched
    expect(copied).toHaveLength(4 * 5 + 1);
    expect(copyDay(mon, 0, [0])).toEqual(mon);
  });

  it("weekday evenings adds Mon–Fri 6–10 pm; changed cells count both ways", () => {
    const evenings = weekdayEvenings([slotOf(6, 0)]);
    expect(evenings).toHaveLength(5 * 8 + 1);
    expect(countChanged([1, 2, 3], [2, 3, 4, 5])).toBe(3);
    expect(countChanged(evenings, evenings)).toBe(0);
  });
});
