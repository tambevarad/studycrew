import { describe, expect, it } from "vitest";
import { getCoverageModel } from "@/server/ai";
import { keywords, MockCoverageModel, splitRequirements } from "@/server/ai/mock-model";

const instructions = `Your presentation must:
- Explain the benefits of social media with research examples
- Explain the drawbacks of social media with research examples
- Conclude with a recommendation for students`;

const draft = `Social media helps students stay connected. A 2021 study found benefits for research collaboration and examples of peer support.
We conclude with a recommendation that students limit late-night use.`;

describe("MockCoverageModel", () => {
  it("is what tests get from the factory", () => {
    expect(getCoverageModel().provider).toBe("mock");
  });

  it("splits bullets into requirements", () => {
    expect(splitRequirements(instructions)).toHaveLength(3);
    expect(splitRequirements("Write an essay. Cite three sources.")).toEqual(["Write an essay.", "Cite three sources."]);
    expect(keywords("The Benefits of Social Media")).toEqual(["benefit", "social", "media"]);
  });

  it("marks the proposal example: drawbacks missing, conclusion covered", async () => {
    const model = new MockCoverageModel();
    const input = { workType: "PRESENTATION" as const, instructions, draft };
    const reqs = await model.extractRequirements(input);
    const items = await model.checkRequirements(input, reqs);
    const byReq = Object.fromEntries(items.map((i) => [i.requirement.split(" ")[2], i]));
    expect(byReq.benefits.status).not.toBe("MISSING");
    expect(byReq.drawbacks.status).not.toBe("COVERED");
    expect(items[2].status).toBe("COVERED");
    for (const i of items) if (i.evidenceQuote) expect(draft).toContain(i.evidenceQuote);
    for (const i of items) if (i.status !== "COVERED") expect(i.suggestion).toBeTruthy();
    const none = await model.checkRequirements(input, ["Discuss quantum chromodynamics"]);
    expect(none[0]).toMatchObject({ status: "MISSING", evidenceQuote: null });
  });
});
