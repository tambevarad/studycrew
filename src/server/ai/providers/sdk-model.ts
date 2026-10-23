import { generateText, LoadAPIKeyError, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { COVERAGE_STATUSES } from "@/contracts/coverage";
import { CHECK_SYSTEM, checkPrompt, EXTRACT_SYSTEM, extractPrompt, MAX_REQUIREMENTS } from "../prompts";
import type { CoverageModel, CoverageModelInput, CoverageModelItem, ProviderName } from "../types";

/**
 * Strict output schemas. Every field is required and nullable instead of optional, because OpenAI's strict
 * structured outputs reject optional properties. Length limits on strings are enforced by the service
 * (clampQuote), not here, since not every provider supports maxLength in JSON schema.
 */
export const requirementsSchema = z.object({
  requirements: z
    .array(z.string().describe("One checkable requirement as a short imperative sentence."))
    .max(MAX_REQUIREMENTS),
});

export const checkedItemsSchema = z.object({
  items: z.array(
    z.object({
      requirement: z.string().describe("The requirement text, copied unchanged."),
      status: z.enum(COVERAGE_STATUSES),
      evidenceQuote: z
        .string()
        .nullable()
        .describe("A passage copied word for word from the draft, or null when MISSING."),
      reason: z.string().describe("One short sentence explaining the status."),
      suggestion: z.string().nullable().describe("One concrete next step for the students, or null when COVERED."),
    }),
  ),
});

type ProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

/**
 * CoverageModel on top of the Vercel AI SDK v7 (`generateText` + `Output.object`; `generateObject` is
 * deprecated in v7). Provider files only choose the LanguageModel and options.
 *
 * `maxRetries: 1`: one retry on a transient 429/5xx still fits the 30 s budget; more would not.
 * The caller's AbortSignal cancels the HTTP request, including any retry.
 */
export class SdkCoverageModel implements CoverageModel {
  constructor(
    readonly provider: ProviderName,
    readonly model: string,
    private readonly languageModel: LanguageModel,
    /** Env var holding the key. Checked before every call (see assertConfigured). */
    private readonly apiKeyEnv: string,
    private readonly providerOptions?: ProviderOptions,
  ) {}

  /**
   * The SDK treats an EMPTY key as set and sends the request anyway (then gets a 401). Our .env.example ships
   * `OPENAI_API_KEY=""`, so without this check the student's text would leave StudyCrew with no usable key.
   */
  private assertConfigured() {
    if (!process.env[this.apiKeyEnv]?.trim()) {
      throw new LoadAPIKeyError({
        message: `${this.apiKeyEnv} is not set, so the ${this.provider} provider can't be used.`,
      });
    }
  }

  async extractRequirements(input: CoverageModelInput, signal?: AbortSignal): Promise<string[]> {
    this.assertConfigured();
    const { output } = await generateText({
      model: this.languageModel,
      instructions: EXTRACT_SYSTEM,
      prompt: extractPrompt(input),
      output: Output.object({ name: "requirements", schema: requirementsSchema }),
      providerOptions: this.providerOptions,
      maxRetries: 1,
      abortSignal: signal,
    });
    return output.requirements.map((r) => r.trim()).filter(Boolean);
  }

  async checkRequirements(
    input: CoverageModelInput,
    requirements: string[],
    signal?: AbortSignal,
  ): Promise<CoverageModelItem[]> {
    this.assertConfigured();
    const { output } = await generateText({
      model: this.languageModel,
      instructions: CHECK_SYSTEM,
      prompt: checkPrompt(input, requirements),
      output: Output.object({ name: "coverage", schema: checkedItemsSchema }),
      providerOptions: this.providerOptions,
      maxRetries: 1,
      abortSignal: signal,
    });
    return output.items;
  }
}
