/**
 * PB-16 — pure logic of the AI evaluation: matching, metrics, targets, dataset checks. No I/O and no model calls, so
 * tests/unit/ai-eval.test.ts pins all of it with fixed inputs. scripts/ai-eval.ts does the running.
 */
import { COVERAGE_STATUSES, WORK_TYPES, type CoverageStatusValue, type WorkTypeValue } from "@/contracts/coverage";
import { STOPWORDS } from "@/server/ai/mock-model";

export const SUBJECTS = ["Psychology", "Computer Science", "Biology", "History", "Business"] as const;
export const CASES_PER_SUBJECT = 6;

/** A predicted requirement matches an expected one when it contains at least half of the hint's terms. */
export const MATCH_THRESHOLD = 0.5;

export const TARGETS = {
  missingRecall: 0.85,
  missingPrecision: 0.8,
  quoteVerificationRate: 0.95,
  p95LatencyMs: 30_000,
};

/** USD per 1M tokens, Anthropic first-party rates for prompts under 100K tokens (checked 2026-11-03). */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export interface ExpectedItem {
  requirementHint: string;
  status: CoverageStatusValue;
}

export interface EvalCase {
  id: string;
  subject: string;
  workType: WorkTypeValue;
  instructions: string;
  draft: string;
  expected: ExpectedItem[];
  /** What was seeded on purpose, for the dataset table (AC1). */
  notes: string;
}

export interface PredictedItem {
  requirement: string;
  status: CoverageStatusValue;
  evidenceQuote: string | null;
  evidenceVerified: boolean;
  reason: string;
  suggestion: string | null;
}

export interface Match {
  expectedIndex: number;
  predictedIndex: number;
  score: number;
}

export interface MatchResult {
  matches: Match[];
  /** Expected requirements the model never listed. */
  notExtracted: number[];
  /** Predicted items that overlap expected requirements already matched (the model split them). */
  splits: Array<{ predictedIndex: number; expectedIndexes: number[] }>;
  /** Predicted items that match nothing in the labels. */
  extras: number[];
}

function stem(word: string): string {
  const singular = word
    .replace(/ies$/, "y")
    .replace(/sses$/, "ss")
    .replace(/([^s])s$/, "$1");
  return (singular.length > 4 ? singular.replace(/(ing|ed)$/, "") : singular).replace(/e$/, "");
}

/** Stemmed content words. Hyphens split ("peer-reviewed"), so "side"/"sides" and "cite"/"cited" compare equal. */
export function terms(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .replace(/'s\b/g, "")
      .match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOPWORDS.has(w)).map(stem))];
}

/** Same stem, or one is a long prefix of the other ("compar" and "comparison"). */
function sameTerm(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

/** Share of the hint's terms found in the predicted requirement. */
export function overlap(hint: string, requirement: string): number {
  const want = terms(hint);
  if (want.length === 0) return 0;
  const have = terms(requirement);
  return want.filter((k) => have.some((h) => sameTerm(k, h))).length / want.length;
}

/** Greedy one-to-one matching, best overlap first, so "drawbacks of X" can't take the slot of "benefits of X". */
export function matchItems(expected: ExpectedItem[], predicted: PredictedItem[]): MatchResult {
  const candidates: Match[] = [];
  expected.forEach((e, expectedIndex) =>
    predicted.forEach((p, predictedIndex) => {
      const score = overlap(e.requirementHint, p.requirement);
      if (score >= MATCH_THRESHOLD) candidates.push({ expectedIndex, predictedIndex, score });
    }),
  );
  candidates.sort(
    (a, b) => b.score - a.score || a.expectedIndex - b.expectedIndex || a.predictedIndex - b.predictedIndex,
  );

  const matches: Match[] = [];
  const usedExpected = new Set<number>();
  const usedPredicted = new Set<number>();
  for (const c of candidates) {
    if (usedExpected.has(c.expectedIndex) || usedPredicted.has(c.predictedIndex)) continue;
    matches.push(c);
    usedExpected.add(c.expectedIndex);
    usedPredicted.add(c.predictedIndex);
  }

  const splits: MatchResult["splits"] = [];
  const extras: number[] = [];
  predicted.forEach((_, predictedIndex) => {
    if (usedPredicted.has(predictedIndex)) return;
    const expectedIndexes = candidates.filter((c) => c.predictedIndex === predictedIndex).map((c) => c.expectedIndex);
    if (expectedIndexes.length > 0) splits.push({ predictedIndex, expectedIndexes });
    else extras.push(predictedIndex);
  });

  return {
    matches: matches.sort((a, b) => a.expectedIndex - b.expectedIndex),
    notExtracted: expected.map((_, i) => i).filter((i) => !usedExpected.has(i)),
    splits,
    extras,
  };
}

export type ConfusionColumn = CoverageStatusValue | "NOT_EXTRACTED";
export type Confusion = Record<CoverageStatusValue, Record<ConfusionColumn, number>>;

export interface CaseScore {
  /** Expected MISSING, predicted MISSING. */
  truePositives: number;
  /** Expected MISSING, anything else (including never extracted). */
  falseNegatives: number;
  /** Predicted MISSING on something that isn't missing, or on a requirement that isn't in the labels. */
  falsePositives: number;
  confusion: Confusion;
}

export function emptyConfusion(): Confusion {
  const row = (): Record<ConfusionColumn, number> => ({ COVERED: 0, PARTIAL: 0, MISSING: 0, NOT_EXTRACTED: 0 });
  return { COVERED: row(), PARTIAL: row(), MISSING: row() };
}

/**
 * Missing is the status a student acts on, so it is scored strictly: a PARTIAL for an expected MISSING is a miss.
 * A split that says MISSING is neutral if any requirement it overlaps is MISSING or PARTIAL (part of it really is
 * missing, and it mustn't count twice). If it only overlaps COVERED ones, or is an unlabeled extra, it's a false alarm.
 */
export function scoreCase(expected: ExpectedItem[], predicted: PredictedItem[], match: MatchResult): CaseScore {
  const confusion = emptyConfusion();
  let truePositives = 0;
  let falseNegatives = 0;
  let falsePositives = 0;

  for (const m of match.matches) {
    const want = expected[m.expectedIndex].status;
    const got = predicted[m.predictedIndex].status;
    confusion[want][got] += 1;
    if (want === "MISSING" && got === "MISSING") truePositives += 1;
    else if (want === "MISSING") falseNegatives += 1;
    else if (got === "MISSING") falsePositives += 1;
  }
  for (const i of match.notExtracted) {
    confusion[expected[i].status].NOT_EXTRACTED += 1;
    if (expected[i].status === "MISSING") falseNegatives += 1;
  }
  for (const s of match.splits) {
    const onlyCovered = s.expectedIndexes.every((i) => expected[i].status === "COVERED");
    if (predicted[s.predictedIndex].status === "MISSING" && onlyCovered) falsePositives += 1;
  }
  for (const i of match.extras) {
    if (predicted[i].status === "MISSING") falsePositives += 1;
  }
  return { truePositives, falseNegatives, falsePositives, confusion };
}

/** Nearest-rank percentile. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export interface CaseRun {
  id: string;
  latencyMs: number;
  /** Set when the run failed (timeout or provider error); the case then has no score. */
  error: string | null;
  predicted: PredictedItem[];
  score: CaseScore | null;
}

export interface Metrics {
  cases: number;
  failedCases: number;
  missingExpected: number;
  missingPredicted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  missingRecall: number;
  missingPrecision: number;
  quotes: number;
  quotesVerified: number;
  quoteVerificationRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  confusion: Confusion;
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

/** Failed cases have no predictions, so they're left out of the rates but still count toward latency. */
export function computeMetrics(runs: CaseRun[]): Metrics {
  const confusion = emptyConfusion();
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let quotes = 0;
  let quotesVerified = 0;
  for (const run of runs) {
    if (run.score) {
      truePositives += run.score.truePositives;
      falsePositives += run.score.falsePositives;
      falseNegatives += run.score.falseNegatives;
      for (const want of COVERAGE_STATUSES) {
        for (const got of [...COVERAGE_STATUSES, "NOT_EXTRACTED"] as const)
          confusion[want][got] += run.score.confusion[want][got];
      }
    }
    for (const item of run.predicted) {
      if (item.evidenceQuote === null) continue;
      quotes += 1;
      if (item.evidenceVerified) quotesVerified += 1;
    }
  }
  const latencies = runs.map((r) => r.latencyMs);
  return {
    cases: runs.length,
    failedCases: runs.filter((r) => r.error !== null).length,
    missingExpected: truePositives + falseNegatives,
    missingPredicted: truePositives + falsePositives,
    truePositives,
    falsePositives,
    falseNegatives,
    missingRecall: ratio(truePositives, truePositives + falseNegatives),
    missingPrecision: ratio(truePositives, truePositives + falsePositives),
    quotes,
    quotesVerified,
    quoteVerificationRate: ratio(quotesVerified, quotes),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    confusion,
  };
}

export interface TargetCheck {
  label: string;
  target: string;
  actual: string;
  met: boolean;
}

export function checkTargets(m: Metrics): TargetCheck[] {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const ratioText = (n: number) => n.toFixed(3);
  return [
    {
      label: "Missing recall",
      target: `≥ ${TARGETS.missingRecall.toFixed(2)}`,
      actual: `${ratioText(m.missingRecall)} (${m.truePositives}/${m.missingExpected})`,
      met: m.missingRecall >= TARGETS.missingRecall,
    },
    {
      label: "Missing precision",
      target: `≥ ${TARGETS.missingPrecision.toFixed(2)}`,
      actual: `${ratioText(m.missingPrecision)} (${m.truePositives}/${m.missingPredicted})`,
      met: m.missingPrecision >= TARGETS.missingPrecision,
    },
    {
      label: "Quote verification rate",
      target: `≥ ${pct(TARGETS.quoteVerificationRate)}`,
      actual: `${pct(m.quoteVerificationRate)} (${m.quotesVerified}/${m.quotes})`,
      met: m.quoteVerificationRate >= TARGETS.quoteVerificationRate,
    },
    {
      label: "p95 latency",
      target: `≤ ${(TARGETS.p95LatencyMs / 1000).toFixed(1)} s`,
      actual: `${(m.p95LatencyMs / 1000).toFixed(1)} s`,
      met: m.p95LatencyMs <= TARGETS.p95LatencyMs,
    },
  ];
}

/** The results table, generated once here so the report and the metrics file can't drift apart (AC2). */
export function resultsTable(checks: TargetCheck[]): string {
  return [
    "| Metric | Target | Result | Met? |",
    "|---|---|---|---|",
    ...checks.map((c) => `| ${c.label} | ${c.target} | ${c.actual} | ${c.met ? "✅ Yes" : "❌ No"} |`),
  ].join("\n");
}

export function confusionTable(c: Confusion): string {
  const head = "| Expected ↓ / Predicted → | Covered | Partial | Missing | Not extracted |";
  const rows = COVERAGE_STATUSES.map((want) => {
    const r = c[want];
    return `| ${want[0]}${want.slice(1).toLowerCase()} | ${r.COVERED} | ${r.PARTIAL} | ${r.MISSING} | ${r.NOT_EXTRACTED} |`;
  });
  return [head, "|---|---|---|---|---|", ...rows].join("\n");
}

/** Null when the model has no price on file. */
export function estimateCostUsd(model: string, tokens: { input: number; output: number }): number | null {
  const price = PRICES_PER_MTOK[model];
  if (!price) return null;
  return (tokens.input * price.input + tokens.output * price.output) / 1_000_000;
}

/** AC1: everything that must hold for the dataset. Returns the problems found (none = valid). */
export function validateCases(cases: EvalCase[]): string[] {
  const problems: string[] = [];
  if (cases.length !== SUBJECTS.length * CASES_PER_SUBJECT) problems.push(`expected 30 cases, found ${cases.length}`);
  for (const subject of SUBJECTS) {
    const n = cases.filter((c) => c.subject === subject).length;
    if (n !== CASES_PER_SUBJECT) problems.push(`${subject} has ${n} cases, expected ${CASES_PER_SUBJECT}`);
  }
  for (const type of WORK_TYPES) {
    if (!cases.some((c) => c.workType === type)) problems.push(`no case uses work type ${type}`);
  }
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) problems.push(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!(SUBJECTS as readonly string[]).includes(c.subject)) problems.push(`${c.id}: unknown subject ${c.subject}`);
    if (!WORK_TYPES.includes(c.workType)) problems.push(`${c.id}: unknown work type ${c.workType}`);
    if (!c.instructions.trim() || !c.draft.trim()) problems.push(`${c.id}: empty instructions or draft`);
    if (!c.notes.trim()) problems.push(`${c.id}: seeded gaps aren't documented`);
    if (c.expected.length < 3) problems.push(`${c.id}: fewer than 3 labeled requirements`);
    for (const e of c.expected) {
      if (!COVERAGE_STATUSES.includes(e.status)) problems.push(`${c.id}: bad status ${e.status}`);
      if (terms(e.requirementHint).length === 0) problems.push(`${c.id}: hint "${e.requirementHint}" has no terms`);
    }
  }
  return problems;
}
