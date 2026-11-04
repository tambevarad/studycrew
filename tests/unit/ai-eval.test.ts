import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CoverageStatusValue } from "@/contracts/coverage";
import {
  checkTargets,
  computeMetrics,
  confusionTable,
  emptyConfusion,
  estimateCostUsd,
  matchItems,
  overlap,
  percentile,
  resultsTable,
  scoreCase,
  TARGETS,
  terms,
  validateCases,
  type CaseRun,
  type EvalCase,
  type ExpectedItem,
  type Metrics,
  type PredictedItem,
  type TargetCheck,
} from "../ai-eval/lib";

/** Fixed inputs only: nothing here calls a model (the evaluation itself never runs in tests). */
const predicted = (
  requirement: string,
  status: CoverageStatusValue,
  quote: string | null = null,
  verified = false,
): PredictedItem => ({
  requirement,
  status,
  evidenceQuote: quote,
  evidenceVerified: verified,
  reason: "r",
  suggestion: null,
});
const expected = (requirementHint: string, status: CoverageStatusValue): ExpectedItem => ({ requirementHint, status });

function score(want: ExpectedItem[], got: PredictedItem[]) {
  return scoreCase(want, got, matchItems(want, got));
}

describe("PB-16 matching", () => {
  it("terms handle plurals, verb forms, hyphens, and possessives", () => {
    expect(terms("sides")).toEqual(terms("side"));
    expect(terms("cites")).toEqual(terms("cited"));
    expect(terms("studies")).toEqual(terms("study"));
    expect(terms("peer-reviewed Maya's")).toEqual(["peer", "review", "maya"]);
    expect(terms("the of and explain")).toEqual([]);
  });

  it("overlap is the share of the hint's terms in the requirement", () => {
    expect(overlap("compare two sides stronger", "State which side of the comparison is stronger")).toBe(1);
    expect(overlap("benefits social media", "Explain the benefits of social media")).toBe(1);
    expect(overlap("drawbacks social media", "Explain the benefits of social media")).toBeCloseTo(2 / 3);
    expect(overlap("space complexity", "Compare the time complexity")).toBe(0.5);
    expect(overlap("the of and", "anything")).toBe(0);
  });

  it("near-twin requirements each find their own match, whatever the order", () => {
    const want = [expected("benefits social media", "COVERED"), expected("drawbacks social media", "MISSING")];
    const got = [
      predicted("Explain the drawbacks of social media", "MISSING"),
      predicted("Explain the benefits of social media", "COVERED"),
    ];
    expect(matchItems(want, got).matches).toEqual([
      { expectedIndex: 0, predictedIndex: 1, score: 1 },
      { expectedIndex: 1, predictedIndex: 0, score: 1 },
    ]);
  });

  it("reports requirements never extracted, splits, and unlabeled extras", () => {
    const want = [expected("cite peer-reviewed sources APA", "PARTIAL"), expected("legal risks", "MISSING")];
    const got = [
      predicted("Cite peer-reviewed sources in APA format", "PARTIAL"),
      predicted("Cite at least three peer-reviewed sources", "MISSING"),
      predicted("Submit the slides by Friday", "MISSING"),
    ];
    const m = matchItems(want, got);
    expect(m.matches.map((x) => x.predictedIndex)).toEqual([0]);
    expect(m.notExtracted).toEqual([1]);
    expect(m.splits).toEqual([{ predictedIndex: 1, expectedIndexes: [0] }]);
    expect(m.extras).toEqual([2]);
  });
});

describe("PB-16 scoring", () => {
  it("a correct Missing is a true positive; Partial for an expected Missing is a miss", () => {
    const want = [expected("legal risks memo", "MISSING"), expected("customer notice sentence", "MISSING")];
    const got = [
      predicted("List the legal risks in the memo", "MISSING"),
      predicted("Draft the customer notice sentence", "PARTIAL"),
    ];
    expect(score(want, got)).toMatchObject({ truePositives: 1, falseNegatives: 1, falsePositives: 0 });
  });

  it("a requirement the model never listed counts against recall", () => {
    const s = score([expected("legal risks memo", "MISSING")], [predicted("Something else entirely", "COVERED")]);
    expect(s).toMatchObject({ truePositives: 0, falseNegatives: 1, falsePositives: 0 });
    expect(s.confusion.MISSING.NOT_EXTRACTED).toBe(1);
  });

  it("Missing on something covered, partial, or unlabeled is a false alarm", () => {
    const want = [expected("benefits social media", "COVERED"), expected("drawbacks social media", "PARTIAL")];
    const got = [
      predicted("Explain benefits of social media", "MISSING"),
      predicted("Explain drawbacks of social media", "MISSING"),
      predicted("Upload the file to Canvas", "MISSING"),
    ];
    expect(score(want, got).falsePositives).toBe(3);
  });

  it("a split says Missing: neutral under a Missing or Partial requirement, a false alarm under a Covered one", () => {
    const split = [
      predicted("Cite peer-reviewed sources APA", "PARTIAL"),
      predicted("Cite peer-reviewed sources", "MISSING"),
    ];
    expect(score([expected("cite peer-reviewed sources APA", "PARTIAL")], split).falsePositives).toBe(0);
    expect(score([expected("cite peer-reviewed sources APA", "COVERED")], split).falsePositives).toBe(1);
  });

  it("a split overlapping a Covered and a Missing requirement gets the benefit of the doubt", () => {
    const want = [expected("benefits social media", "COVERED"), expected("drawbacks social media", "MISSING")];
    const got = [
      predicted("Explain the benefits of social media", "COVERED"),
      predicted("Explain the drawbacks of social media", "MISSING"),
      predicted("Compare the benefits and drawbacks of social media", "MISSING"),
    ];
    expect(score(want, got)).toMatchObject({ truePositives: 1, falsePositives: 0, falseNegatives: 0 });
  });

  it("fills the confusion matrix row by expected status", () => {
    const want = [expected("benefits social media", "COVERED"), expected("drawbacks social media", "MISSING")];
    const got = [
      predicted("Explain benefits of social media", "COVERED"),
      predicted("Explain drawbacks of social media", "PARTIAL"),
    ];
    const { confusion } = score(want, got);
    expect(confusion.COVERED.COVERED).toBe(1);
    expect(confusion.MISSING.PARTIAL).toBe(1);
    expect(confusionTable(confusion)).toContain("| Missing | 0 | 1 | 0 | 0 |");
  });
});

describe("PB-16 metrics", () => {
  const scored = (tp: number, fp: number, fn: number) => ({
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    confusion: emptyConfusion(),
  });
  const run = (over: Partial<CaseRun>): CaseRun => ({
    id: "x",
    latencyMs: 1000,
    error: null,
    predicted: [],
    score: scored(0, 0, 0),
    ...over,
  });

  it("percentile is nearest-rank", () => {
    const values = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(29);
    expect(percentile(values, 50)).toBe(15);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBe(0);
  });

  it("computes recall, precision, and the quote rate across cases", () => {
    const m = computeMetrics([
      run({
        score: scored(3, 1, 1),
        predicted: [predicted("a", "COVERED", "real quote here", true), predicted("b", "MISSING")],
      }),
      run({ score: scored(1, 0, 0), predicted: [predicted("c", "PARTIAL", "invented quote here", false)] }),
    ]);
    expect(m).toMatchObject({
      truePositives: 4,
      falsePositives: 1,
      falseNegatives: 1,
      missingExpected: 5,
      missingPredicted: 5,
    });
    expect(m.missingRecall).toBeCloseTo(0.8);
    expect(m.missingPrecision).toBeCloseTo(0.8);
    expect(m).toMatchObject({ quotes: 2, quotesVerified: 1, quoteVerificationRate: 0.5 });
  });

  it("a failed case has no score but still counts toward latency", () => {
    const m = computeMetrics([
      run({ latencyMs: 1000, score: scored(1, 0, 0) }),
      run({ latencyMs: 30_000, error: "TimeoutError", score: null }),
    ]);
    expect(m).toMatchObject({ cases: 2, failedCases: 1, truePositives: 1, p95LatencyMs: 30_000 });
  });

  it("empty sets give 0, not NaN", () => {
    expect(computeMetrics([])).toMatchObject({ missingRecall: 0, missingPrecision: 0, quoteVerificationRate: 0 });
  });

  it("AC3: targets are met exactly at the threshold and not below it", () => {
    const base = computeMetrics([]);
    const at: Metrics = {
      ...base,
      missingRecall: 0.85,
      missingPrecision: 0.8,
      quoteVerificationRate: 0.95,
      p95LatencyMs: 30_000,
    };
    expect(checkTargets(at).every((c) => c.met)).toBe(true);
    const below: Metrics = {
      ...at,
      missingRecall: 0.849,
      missingPrecision: 0.799,
      quoteVerificationRate: 0.949,
      p95LatencyMs: 30_001,
    };
    expect(checkTargets(below).some((c) => c.met)).toBe(false);
    expect(TARGETS).toEqual({
      missingRecall: 0.85,
      missingPrecision: 0.8,
      quoteVerificationRate: 0.95,
      p95LatencyMs: 30_000,
    });
  });

  it("the results table says plainly whether each target was met", () => {
    const table = resultsTable(
      checkTargets({
        ...computeMetrics([]),
        missingRecall: 0.9,
        missingPrecision: 0.5,
        truePositives: 9,
        missingExpected: 10,
        missingPredicted: 18,
      }),
    );
    expect(table).toContain("| Missing recall | ≥ 0.85 | 0.900 (9/10) | ✅ Yes |");
    expect(table).toContain("| Missing precision | ≥ 0.80 | 0.500 (9/18) | ❌ No |");
  });

  it("estimates cost from actual tokens, and admits when it has no price", () => {
    expect(estimateCostUsd("claude-haiku-5-5", { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(0.6);
    expect(estimateCostUsd("some-other-model", { input: 1, output: 1 })).toBeNull();
  });
});

const CASES_DIR = path.resolve("tests/ai-eval/cases");
const RESULTS_DIR = path.resolve("tests/ai-eval/results");
const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"));
const cases = files.map((f) => JSON.parse(readFileSync(path.join(CASES_DIR, f), "utf8")) as EvalCase);

describe("PB-16 dataset", () => {
  it("AC1: 30 labeled cases, 5 subjects of 6, all four work types, gaps documented", () => {
    expect(validateCases(cases)).toEqual([]);
  });

  it("the validator catches a broken dataset", () => {
    const broken = cases.slice(1).map((c, i) => (i === 0 ? { ...c, notes: "", expected: [] } : c));
    expect(validateCases(broken).join("\n")).toMatch(
      /expected 30 cases[\s\S]*has 5 cases[\s\S]*seeded gaps[\s\S]*fewer than 3/,
    );
  });

  it("AC1: file names match ids, and seeded gaps exist beside clean drafts", () => {
    for (const [i, file] of files.entries()) {
      expect(file).toBe(`${cases[i].id}.json`);
      expect(file).toMatch(/^\d{2}-[a-z0-9-]+\.json$/);
    }
    const missing = cases.flatMap((c) => c.expected).filter((e) => e.status === "MISSING").length;
    const clean = cases.filter((c) => c.expected.every((e) => e.status === "COVERED")).length;
    expect(missing).toBeGreaterThanOrEqual(30);
    expect(clean).toBeGreaterThanOrEqual(5);
  });

  it("every hint is written from the instructions, so a correct extraction can match it", () => {
    for (const c of cases) {
      for (const e of c.expected)
        expect(overlap(e.requirementHint, c.instructions), `${c.id}: ${e.requirementHint}`).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe("PB-16 stays out of CI", () => {
  it("the script refuses to start under CI or Vitest", () => {
    const res = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/ai-eval.ts", "--mock"], {
      env: { ...process.env, CI: "1" },
      encoding: "utf8",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("never runs in CI");
  });

  it("CI never runs it, and Vitest can't pick the eval folder up", () => {
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).not.toContain("ai:eval");
    expect(readdirSync("tests/ai-eval").filter((f) => f.endsWith(".test.ts"))).toEqual([]);
  });
});

interface ResultsFile {
  promptVersion: string;
  metrics: Metrics;
  targets: TargetCheck[];
  runs: CaseRun[];
}
const results = existsSync(RESULTS_DIR)
  ? readdirSync(RESULTS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ file: f, data: JSON.parse(readFileSync(path.join(RESULTS_DIR, f), "utf8")) as ResultsFile }))
  : [];

describe.skipIf(results.length === 0)("PB-16 results and report", () => {
  const report = existsSync("docs/ai-eval-report.md") ? readFileSync("docs/ai-eval-report.md", "utf8") : "";

  it.each(results)("AC2: $file holds metrics that follow from its own runs", ({ data }) => {
    expect(computeMetrics(data.runs)).toEqual(data.metrics);
    expect(checkTargets(data.metrics)).toEqual(data.targets);
  });

  it.each(results)("AC2/AC3: the report's tables for $file match it exactly", ({ data }) => {
    expect(report).toContain(resultsTable(data.targets));
    expect(report).toContain(confusionTable(data.metrics.confusion));
    expect(report).toContain(data.promptVersion);
  });
});
