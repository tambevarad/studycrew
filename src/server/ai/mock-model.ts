import type { CoverageModel, CoverageModelInput, CoverageModelItem } from "./types";

/**
 * Deterministic keyword model used in every automated test and whenever no API key
 * is configured. NOT an evaluation baseline for the real model — just predictable.
 *
 * - Requirements: each bullet/numbered line, or each sentence if there are no bullets.
 * - Matching: share of the requirement's keywords found in the best draft sentence.
 *   ≥ 0.6 → COVERED, ≥ 0.3 → PARTIAL, else MISSING. Quote = that sentence, verbatim.
 */
const STOPWORDS = new Set(
  "a an and are as at be by for from has have how in include includes including is it its of on or that the their this to was were what when where which who why will with your you must should each least one two three explain describe discuss provide give use using about into than then also make".split(
    " ",
  ),
);

export function keywords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOPWORDS.has(w)).map(stem))];
}

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/u, "") || w;
}

export function splitRequirements(instructions: string): string[] {
  const lines = instructions.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .filter((l) => /^([-*•]|\d+[.)]|[a-z][.)])\s+/i.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)]|[a-z][.)])\s+/i, "").trim());
  const source = bullets.length > 0 ? bullets : splitSentences(instructions);
  return source.filter((r) => keywords(r).length > 0).slice(0, 25);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export class MockCoverageModel implements CoverageModel {
  readonly provider = "mock" as const;
  readonly model = "keyword-mock-v1";

  async extractRequirements(input: CoverageModelInput): Promise<string[]> {
    return splitRequirements(input.instructions);
  }

  async checkRequirements(input: CoverageModelInput, requirements: string[]): Promise<CoverageModelItem[]> {
    const sentences = splitSentences(input.draft);
    return requirements.map((requirement) => {
      const req = keywords(requirement);
      let best = { sentence: null as string | null, ratio: 0 };
      for (const sentence of sentences) {
        const have = new Set(keywords(sentence));
        const ratio = req.length === 0 ? 0 : req.filter((k) => have.has(k)).length / req.length;
        if (ratio > best.ratio) best = { sentence, ratio };
      }
      if (best.ratio >= 0.6) {
        return { requirement, status: "COVERED", evidenceQuote: best.sentence, reason: "The draft addresses this directly.", suggestion: null };
      }
      if (best.ratio >= 0.3) {
        return {
          requirement,
          status: "PARTIAL",
          evidenceQuote: best.sentence,
          reason: "The draft touches on this but leaves parts out.",
          suggestion: `Expand the part of the draft about “${requirement.slice(0, 60)}”.`,
        };
      }
      return {
        requirement,
        status: "MISSING",
        evidenceQuote: null,
        reason: "Nothing in the draft addresses this requirement.",
        suggestion: `Add a section that covers: ${requirement.slice(0, 80)}.`,
      };
    });
  }
}
