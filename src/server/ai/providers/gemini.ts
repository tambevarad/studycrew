import { google } from "@ai-sdk/google";
import { SdkCoverageModel } from "./sdk-model";

/** AI_PROVIDER=gemini. Reads GOOGLE_GENERATIVE_AI_API_KEY at call time. */
export function createGeminiCoverageModel(): SdkCoverageModel {
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  return new SdkCoverageModel("gemini", model, google(model));
}
