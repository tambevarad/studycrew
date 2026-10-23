import { describe, expect, it } from "vitest";
import { clampQuote, normalizeForMatch, verifyQuote } from "@/server/ai/quotes";

const draft = `Social media helps students stay connected.
A 2021 study found “benefits” for research   collaboration — and examples of peer support.
We conclude with a recommendation that students limit late-night use.`;

describe("PB-10 quote verification", () => {
  it("normalizes whitespace, quotes, dashes, and case", () => {
    expect(normalizeForMatch("  Hello \n\t World  ")).toBe("hello world");
    expect(normalizeForMatch("“It’s” ‘fine’")).toBe(`"it's" 'fine'`);
    expect(normalizeForMatch("a – b — c ‒ d")).toBe("a - b - c - d");
    expect(normalizeForMatch("Wait…")).toBe("wait...");
  });

  it("AC2: accepts a verbatim quote", () => {
    expect(verifyQuote("We conclude with a recommendation that students limit late-night use.", draft)).toBe(true);
  });

  it("AC2: accepts a quote that differs only in line breaks, spacing, curly quotes, dashes, or case", () => {
    expect(verifyQuote('a 2021 study found "benefits" for research collaboration - and examples', draft)).toBe(true);
    expect(verifyQuote("students stay connected. A 2021 study", draft)).toBe(true); // across a line break
  });

  it("AC2: rejects a paraphrase, an invented sentence, or a quote stitched with an ellipsis", () => {
    expect(verifyQuote("A 2021 study showed benefits for research collaboration", draft)).toBe(false);
    expect(verifyQuote("Social media also has serious drawbacks for sleep.", draft)).toBe(false);
    expect(verifyQuote("Social media helps ... limit late-night use.", draft)).toBe(false);
  });

  it("AC2: rejects quotes shorter than three words, empty, or null", () => {
    expect(verifyQuote("Social media", draft)).toBe(false);
    expect(verifyQuote("students — stay", draft)).toBe(false); // the dash is not a word
    expect(verifyQuote("", draft)).toBe(false);
    expect(verifyQuote(null, draft)).toBe(false);
    expect(verifyQuote("helps students stay", draft)).toBe(true);
  });

  it("clamps long quotes at a word boundary, keeping them verbatim", () => {
    const long = "word ".repeat(100).trim();
    const clamped = clampQuote(long, 300);
    expect(clamped.length).toBeLessThanOrEqual(300);
    expect(clamped.endsWith("word")).toBe(true);
    expect(long.startsWith(clamped)).toBe(true);
    expect(clampQuote("  short  ", 300)).toBe("short");
  });
});
