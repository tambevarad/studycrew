import { describe, expect, it } from "vitest";
import { closedSummary, percent, pickWinner, tally } from "@/server/services/polls/results";

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

  it("percent rounds and handles zero votes", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });
});
