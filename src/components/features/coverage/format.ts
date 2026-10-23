import type { CoverageStatusValue } from "@/contracts/coverage";

/** Shared words and colors for coverage statuses (UI guidelines §3: green = Covered, amber = Partial, red = Missing). */
export const STATUS_LABELS: Record<CoverageStatusValue, string> = { COVERED: "Covered", PARTIAL: "Partial", MISSING: "Missing" };
export const STATUS_TONES = { COVERED: "success", PARTIAL: "warning", MISSING: "danger" } as const satisfies Record<
  CoverageStatusValue,
  "success" | "warning" | "danger"
>;
/** Missing first: that's what the team has to act on. */
export const STATUS_ORDER: CoverageStatusValue[] = ["MISSING", "PARTIAL", "COVERED"];

export const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  mock: "built-in test model",
};

/** 15000 → "15,000" without Intl, so server and browser render the same text (no hydration mismatch). */
export function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Well covered";
  if (score >= 50) return "Some gaps";
  return "Major gaps";
}

/** 4210 → "4.2 s" */
export function formatSeconds(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1)} s`;
}
