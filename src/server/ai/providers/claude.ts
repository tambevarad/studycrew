import { anthropic } from "@ai-sdk/anthropic";
import { SdkCoverageModel } from "./sdk-model";

/** AI_PROVIDER=claude. Reads ANTHROPIC_API_KEY at call time. */
export function createClaudeCoverageModel(): SdkCoverageModel {
  const model = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
  return new SdkCoverageModel("claude", model, anthropic(model), "ANTHROPIC_API_KEY");
}
