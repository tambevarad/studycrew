import { describe, expect, it } from "vitest";
import { closeInputToIso, closesInLabel, defaultCloseInputValue, percent } from "@/components/features/polls/poll-utils";
import { closedSummary, pickWinner, tally } from "@/server/services/polls/results";

const options = [
  { id: "a", label: "Library", position: 0 },
  { id: "c", label: "Cafe", position: 2 },
  { id: "b", label: "Zoom", position: 1 },
];
const votes = (...ids: string[]) => ids.map((optionId) => ({ optionId }));

describe("PB-14 tally", () => {
  it("counts votes per option in listed order, zero for options nobody picked", () => {
    expect(tally(options, votes("b", "c", "b"))).toEqual([
      { optionId: "a", label: "Library", position: 0, votes: 0 },
      { optionId: "b", label: "Zoom", position: 1, votes: 2 },
      { optionId: "c", label: "Cafe", position: 2, votes: 1 },
    ]);
  });
});

describe("PB-14 pickWinner (AC4)", () => {
  it("picks the most votes", () => {
    expect(pickWinner(tally(options, votes("c", "c", "b")))?.optionId).toBe("c");
  });

  it("AC4: a tie goes to the option listed first", () => {
    expect(pickWinner(tally(options, votes("c", "b")))?.optionId).toBe("b");
    expect(pickWinner(tally(options, votes("c", "a", "b")))?.optionId).toBe("a");
  });

  it("AC4: no votes → no winner", () => {
    expect(pickWinner(tally(options, []))).toBeNull();
  });
});

describe("PB-14 text helpers", () => {
  it("summarizes the result for activity history (AC3)", () => {
    const w = { optionId: "b", label: "Zoom", position: 1, votes: 3 };
    expect(closedSummary("Where?", w, false)).toBe("closed the poll “Where?” — winner: “Zoom” (3 votes)");
    expect(closedSummary("Where?", { ...w, votes: 1 }, true)).toBe("closed the poll “Where?” at its closing time — winner: “Zoom” (1 vote)");
    expect(closedSummary("Where?", null, false)).toBe("closed the poll “Where?” — no winner (no votes)");
  });

});

describe("PB-14 client helpers (no Intl, fixed clock)", () => {
  const now = new Date("2026-10-30T15:00:00.000Z"); // a fixed instant; nothing depends on today

  it("closesInLabel counts down without Intl", () => {
    const plus = (ms: number) => new Date(now.getTime() + ms).toISOString();
    expect(closesInLabel(plus(2 * 86_400_000 + 5 * 3_600_000), now)).toBe("Closes in 2 d 5 h");
    expect(closesInLabel(plus(86_400_000), now)).toBe("Closes in 1 d");
    expect(closesInLabel(plus(3 * 3_600_000 + 10 * 60_000), now)).toBe("Closes in 3 h 10 min");
    expect(closesInLabel(plus(4 * 60_000 + 30_000), now)).toBe("Closes in 4 min");
    expect(closesInLabel(plus(30_000), now)).toBe("Closing now");
    expect(closesInLabel(plus(-60_000), now)).toBe("Closing now");
  });

  it("defaults the closing time to 2 days later at 9 PM in the viewer's zone", () => {
    expect(defaultCloseInputValue(now, "America/Chicago")).toBe("2026-11-01T21:00");
    expect(defaultCloseInputValue(now, "Asia/Kolkata")).toBe("2026-11-01T21:00");
  });

  it("converts the datetime-local value in the viewer's zone to UTC, across the Nov 1 DST change", () => {
    expect(closeInputToIso("2026-10-31T21:00", "America/Chicago")).toBe("2026-11-01T02:00:00.000Z"); // CDT, UTC-5
    expect(closeInputToIso("2026-11-01T21:00", "America/Chicago")).toBe("2026-11-02T03:00:00.000Z"); // CST, UTC-6
    expect(closeInputToIso("", "America/Chicago")).toBeNull();
    expect(closeInputToIso("2026-11-01", "America/Chicago")).toBeNull();
  });

  it("percent rounds and handles zero votes", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });
});
