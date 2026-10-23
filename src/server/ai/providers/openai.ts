import { openai } from "@ai-sdk/openai";
import { SdkCoverageModel } from "./sdk-model";

/** AI_PROVIDER=openai. Reads OPENAI_API_KEY at call time; a missing or empty key fails the run before anything is sent (FAILED report + 502). */
export function createOpenAICoverageModel(): SdkCoverageModel {
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  return new SdkCoverageModel("openai", model, openai(model), "OPENAI_API_KEY", {
    // Strict JSON schema: the response must match the Zod schema exactly. Low reasoning effort keeps both
    // steps comfortably inside the 30 s budget (NFR-01).
    openai: { strictJsonSchema: true, reasoningEffort: "low" },
  });
}
