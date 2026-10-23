import { MockCoverageModel } from "./mock-model";
import type { CoverageModel, ProviderName } from "./types";

export type { CoverageModel, CoverageModelInput, CoverageModelItem, ProviderName } from "./types";

/**
 * Returns the configured model. AI_PROVIDER = openai | gemini | claude | mock (default: mock).
 * Tests always get the mock (NODE_ENV=test or AI_PROVIDER=mock).
 *
 * PB-10 OWNER: add real adapters in src/server/ai/providers/<name>.ts (Vercel AI SDK,
 * generateObject with a strict Zod schema) and register them in `factories` below.
 * This is the only line in this file you should need to change.
 */
const factories: Partial<Record<ProviderName, () => CoverageModel>> = {
  mock: () => new MockCoverageModel(),
};

export function getCoverageModel(): CoverageModel {
  const name = (process.env.NODE_ENV === "test" ? "mock" : (process.env.AI_PROVIDER ?? "mock")) as ProviderName;
  const make = factories[name];
  if (!make) {
    console.warn(`[ai] provider "${name}" is not registered yet; falling back to mock`);
    return new MockCoverageModel();
  }
  return make();
}
