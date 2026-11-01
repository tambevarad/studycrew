import { describe, expect, it } from "vitest";
import { boardTaskLink, endOfDayIso } from "@/components/features/coverage-actions/due-date";
import { taskDescriptionFor, taskTitleFor } from "@/server/services/coverage-actions/text";

describe("taskTitleFor", () => {
  it("uses the suggestion, else the requirement", () => {
    expect(taskTitleFor({ suggestion: "Add three APA sources", requirement: "Cite sources" })).toBe(
      "Add three APA sources",
    );
    expect(taskTitleFor({ suggestion: null, requirement: "Cite sources" })).toBe("Cite sources");
    expect(taskTitleFor({ suggestion: "   ", requirement: "Cite sources" })).toBe("Cite sources");
  });

  it("collapses whitespace and stays within the 200-character task title limit, cutting at a word", () => {
    const long = `Add ${"a detailed section ".repeat(20)}`;
    const title = taskTitleFor({ suggestion: long, requirement: "x" });
    expect(title.length).toBeLessThanOrEqual(200);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
    expect(taskTitleFor({ suggestion: "Add\n  two   lines", requirement: "x" })).toBe("Add two lines");
  });
});

describe("taskDescriptionFor", () => {
  it("names the report, the requirement and the reason", () => {
    expect(taskDescriptionFor({ requirement: "Cite sources", reason: "No sources found." }, "Psych 101")).toBe(
      "From AI Coverage Check “Psych 101”: Cite sources — No sources found.",
    );
  });
});

describe("endOfDayIso", () => {
  it("is 11:59 pm that day in the viewer's zone, as UTC", () => {
    expect(endOfDayIso("2026-11-05", "America/Chicago")).toBe("2026-11-06T05:59:00.000Z"); // CST, UTC-6
    expect(endOfDayIso("2026-10-30", "America/Chicago")).toBe("2026-10-31T04:59:00.000Z"); // CDT, UTC-5
    expect(endOfDayIso("2026-11-05", "Asia/Kolkata")).toBe("2026-11-05T18:29:00.000Z");
  });

  it("returns null for an empty or malformed date", () => {
    expect(endOfDayIso("", "America/Chicago")).toBeNull();
    expect(endOfDayIso("11/05/2026", "America/Chicago")).toBeNull();
  });
});

describe("boardTaskLink", () => {
  it("opens the task on the board", () => {
    expect(boardTaskLink("t1", "k2")).toBe("/teams/t1/board?task=k2");
  });
});
