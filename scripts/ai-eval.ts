/**
 * PB-16 — runs the 30 labeled cases through the same path as runCoverageCheck (extract → check → alignItems → verifyItems)
 * with the configured real provider, and writes tests/ai-eval/results/<date>-<promptVersion>.json.
 *
 *   AI_PROVIDER=claude npm run ai:eval              full run (about $0.10), writes the results file
 *   AI_PROVIDER=claude npm run ai:eval -- --limit 2 first 2 cases, writes nothing
 *   npm run ai:eval -- --mock                       free dry run on the keyword mock, writes nothing
 *
 * Manual only: it refuses to start in CI or under Vitest (docs/contracts/testing.md). No database is touched.
 * The API key is read from .env.local by the provider; this script only checks that it is set.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { anthropic } from "@ai-sdk/anthropic";
import { wrapLanguageModel } from "ai";
import { config } from "dotenv";
import { AI_TIMEOUT_MS } from "@/contracts/coverage";
import { MAX_REQUIREMENTS, PROMPT_VERSION } from "@/server/ai/prompts";
import { SdkCoverageModel } from "@/server/ai/providers/sdk-model";
import type { CoverageModel } from "@/server/ai/types";
import {
  checkTargets,
  computeMetrics,
  confusionTable,
  estimateCostUsd,
  matchItems,
  resultsTable,
  scoreCase,
  validateCases,
  type CaseRun,
  type EvalCase,
} from "../tests/ai-eval/lib";

const ROOT = path.resolve(__dirname, "..");
const CASES_DIR = path.join(ROOT, "tests/ai-eval/cases");
const RESULTS_DIR = path.join(ROOT, "tests/ai-eval/results");
const API_KEY_ENV: Record<string, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function loadCases(): EvalCase[] {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(CASES_DIR, f), "utf8")) as EvalCase);
}

const tokens = { input: 0, output: 0, measured: false };

/** The real adapter and prompts, with a counter around the language model so the cost comes from actual usage. */
function withUsageCounter(configured: CoverageModel): CoverageModel {
  if (configured.provider !== "claude") return configured;
  tokens.measured = true;
  const counted = wrapLanguageModel({
    model: anthropic(configured.model),
    middleware: {
      specificationVersion: "v4",
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();
        tokens.input += result.usage.inputTokens.total ?? 0;
        tokens.output += result.usage.outputTokens.total ?? 0;
        return result;
      },
    },
  });
  return new SdkCoverageModel("claude", configured.model, counted, "ANTHROPIC_API_KEY");
}

/** Class name and status only: provider errors can echo the request body. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  const status = (err as { statusCode?: number }).statusCode;
  return status ? `${err.name} (HTTP ${status})` : err.name;
}

async function main() {
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : null;
  if (limit !== null && !(limit > 0)) fail("--limit needs a positive number.");

  if (process.env.CI || process.env.VITEST || process.env.NODE_ENV === "test") {
    fail("The AI evaluation calls a paid provider, so it never runs in CI or tests. Run it by hand.");
  }
  config({ path: path.join(ROOT, ".env.local"), quiet: true });
  config({ path: path.join(ROOT, ".env"), quiet: true });
  if (mock) process.env.AI_PROVIDER = "mock";

  const provider = process.env.AI_PROVIDER ?? "mock";
  if (provider === "mock" && !mock) {
    fail(
      "AI_PROVIDER is mock, which isn't an evaluation. Run: AI_PROVIDER=claude npm run ai:eval (or add -- --mock for a dry run).",
    );
  }
  const keyEnv = API_KEY_ENV[provider];
  if (keyEnv && !process.env[keyEnv]?.trim()) fail(`${keyEnv} isn't set. Add it to .env.local, then run this again.`);

  const all = loadCases();
  const problems = validateCases(all);
  if (problems.length > 0) fail(`The dataset is invalid:\n- ${problems.join("\n- ")}`);
  const cases = limit === null ? all : all.slice(0, limit);

  // Loaded here because importing the service needs DATABASE_URL from the env files above (no connection is opened).
  const { getCoverageModel } = await import("@/server/ai");
  const { alignItems, verifyItems, UNVERIFIED_PREFIX, NOT_ASSESSED_REASON } =
    await import("@/server/services/coverage/service");
  const model = withUsageCounter(getCoverageModel());
  console.log(`Running ${cases.length} cases on ${model.provider}/${model.model}, prompt ${PROMPT_VERSION}\n`);

  const runs: Array<CaseRun & { subject: string; workType: string; downgraded: number; notAssessed: number }> = [];
  for (const c of cases) {
    const input = { workType: c.workType, instructions: c.instructions, draft: c.draft };
    const signal = AbortSignal.timeout(AI_TIMEOUT_MS);
    const started = performance.now();
    let run: CaseRun;
    try {
      const requirements = (await model.extractRequirements(input, signal)).slice(0, MAX_REQUIREMENTS);
      const checked = await model.checkRequirements(input, requirements, signal);
      const predicted = verifyItems(alignItems(requirements, checked), c.draft).map((item) => ({
        ...item,
        evidenceQuote: item.evidenceQuote ?? null,
        suggestion: item.suggestion ?? null,
      }));
      const latencyMs = Math.round(performance.now() - started);
      run = {
        id: c.id,
        latencyMs,
        error: null,
        predicted,
        score: scoreCase(c.expected, predicted, matchItems(c.expected, predicted)),
      };
    } catch (err) {
      run = {
        id: c.id,
        latencyMs: Math.round(performance.now() - started),
        error: describeError(err),
        predicted: [],
        score: null,
      };
    }
    runs.push({
      ...run,
      subject: c.subject,
      workType: c.workType,
      downgraded: run.predicted.filter((i) => i.reason.startsWith(UNVERIFIED_PREFIX)).length,
      notAssessed: run.predicted.filter((i) => i.reason === NOT_ASSESSED_REASON).length,
    });
    const s = run.score;
    console.log(
      `${c.id.padEnd(34)} ${(run.latencyMs / 1000).toFixed(1).padStart(5)} s  ` +
        (s ? `TP ${s.truePositives}  FP ${s.falsePositives}  FN ${s.falseNegatives}` : `FAILED: ${run.error}`),
    );
  }

  const metrics = computeMetrics(runs);
  const targets = checkTargets(metrics);
  const costUsd = tokens.measured ? estimateCostUsd(model.model, tokens) : null;
  const table = resultsTable(targets);
  console.log(`\n${table}\n\n${confusionTable(metrics.confusion)}\n`);
  console.log(
    `Failed cases: ${metrics.failedCases}. Tokens: ${tokens.input} in, ${tokens.output} out. Estimated cost: ${costUsd === null ? "n/a" : `$${costUsd.toFixed(4)}`}`,
  );

  if (mock || limit !== null) {
    console.log("\nDry run: no results file written.");
    process.exit(0);
  }
  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${date}-${PROMPT_VERSION}.json`);
  const results = {
    date,
    provider: model.provider,
    model: model.model,
    promptVersion: PROMPT_VERSION,
    metrics,
    targets,
    usage: { inputTokens: tokens.input, outputTokens: tokens.output, costUsd },
    runs,
  };
  writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(ROOT, file)}`);
  process.exit(0);
}

main().catch((err) => fail(`The evaluation stopped: ${describeError(err)}`));
