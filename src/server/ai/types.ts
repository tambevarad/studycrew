/**
 * AI module contract (PB-10). The rest of the app talks to models ONLY through
 * CoverageModel, so providers are swappable with one env setting (AI_PROVIDER).
 *
 * Two steps, per the proposal:
 *   1. extractRequirements: instructions → list of atomic requirements
 *   2. checkRequirements:   each requirement vs the draft → status + verbatim quote
 * The SERVICE (not the model) verifies quotes, computes the score, and persists.
 */
import type { CoverageStatusValue, WorkTypeValue } from "@/contracts/coverage";

export type ProviderName = "openai" | "gemini" | "claude" | "mock";

export interface CoverageModelInput {
  workType: WorkTypeValue;
  instructions: string;
  draft: string;
}

export interface CoverageModelItem {
  requirement: string;
  status: CoverageStatusValue;
  /** Must be copied word-for-word from the draft, or null when MISSING. */
  evidenceQuote: string | null;
  /** One line explaining the status. */
  reason: string;
  /** One concrete next step, or null when COVERED. Never writes the content for the student. */
  suggestion: string | null;
}

export interface CoverageModel {
  readonly provider: ProviderName;
  readonly model: string;
  extractRequirements(input: CoverageModelInput, signal?: AbortSignal): Promise<string[]>;
  checkRequirements(input: CoverageModelInput, requirements: string[], signal?: AbortSignal): Promise<CoverageModelItem[]>;
}
