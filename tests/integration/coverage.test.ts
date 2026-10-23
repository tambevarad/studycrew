import { LoadAPIKeyError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as GET_ONE, DELETE } from "@/app/api/v1/teams/[teamId]/coverage-reports/[reportId]/route";
import { GET, POST } from "@/app/api/v1/teams/[teamId]/coverage-reports/route";
import { MAX_RUNS_PER_USER_PER_DAY, type RunCoverageInput } from "@/contracts/coverage";
import { db } from "@/server/db";
import type { CoverageModel, CoverageModelItem } from "@/server/ai";
import { MockCoverageModel } from "@/server/ai/mock-model";
import {
  deleteReport,
  getReport,
  listReports,
  PROVIDER_ERROR_MESSAGE,
  RATE_LIMIT_MESSAGE,
  remainingRunsToday,
  runCoverageCheck,
  TIMEOUT_MESSAGE,
  UNVERIFIED_PREFIX,
} from "@/server/services/coverage/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

// Lets a route test swap the model the POST handler gets. Tests never reach a real provider either way.
const routeModel = vi.hoisted(() => ({ current: null as CoverageModel | null }));
vi.mock("@/server/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/ai")>();
  return { ...actual, getCoverageModel: () => routeModel.current ?? actual.getCoverageModel() };
});

afterEach(() => {
  routeModel.current = null;
  vi.restoreAllMocks();
});

/** The proposal's psychology example (PB-10 AC1), plus one requirement nothing in the draft touches. */
const INSTRUCTIONS = `Your presentation must:
- Explain the benefits of social media with research examples
- Explain the drawbacks of social media with research examples
- Conclude with a recommendation for students
- Cite at least three peer-reviewed sources in APA format`;
const DRAFT = `Social media helps students stay connected. A 2021 study found benefits for research collaboration and examples of peer support.
We conclude with a recommendation that students limit late-night use.`;

const input = (over: Partial<RunCoverageInput> = {}): RunCoverageInput => ({
  title: "Psych 101 presentation",
  workType: "PRESENTATION",
  instructions: INSTRUCTIONS,
  draft: DRAFT,
  consent: true,
  ...over,
});

/** A hand-written CoverageModel that returns fixed items (and records whether it was called). */
function fakeModel(items: CoverageModelItem[], requirements = items.map((i) => i.requirement)) {
  const calls = { extract: 0, check: 0 };
  const model: CoverageModel = {
    provider: "openai",
    model: "fake-gpt",
    async extractRequirements() {
      calls.extract++;
      return requirements;
    },
    async checkRequirements() {
      calls.check++;
      return items;
    },
  };
  return { model, calls };
}

/** Ignores the AbortSignal and never settles — the worst-behaved provider. */
const hangingModel: CoverageModel = {
  provider: "openai",
  model: "fake-gpt",
  extractRequirements: () => new Promise<string[]>(() => {}),
  checkRequirements: () => new Promise<CoverageModelItem[]>(() => {}),
};

const NOW = new Date("2026-10-28T15:00:00Z");

async function insertReports(teamId: string, authorId: string, n: number, createdAt: Date) {
  for (let i = 0; i < n; i++) {
    await db.coverageReport.create({
      data: {
        teamId,
        authorId,
        title: `Old check ${i}`,
        workType: "REPORT",
        instructions: "x",
        draft: "y",
        status: "COMPLETED",
        score: 50,
        provider: "mock",
        model: "keyword-mock-v1",
        promptVersion: "v1",
        latencyMs: 5,
        createdAt,
      },
    });
  }
}

describe("PB-10 run a coverage check", () => {
  it("AC1: with the mock, the psychology example marks Drawbacks as not Covered, with a suggestion", async () => {
    const { team, members } = await makeTeam({ members: 1 });
    const me = members[0];
    const report = await runCoverageCheck(team.id, me.id, input(), { model: new MockCoverageModel(), now: NOW });

    expect(report).toMatchObject({ status: "COMPLETED", provider: "mock", model: "keyword-mock-v1", promptVersion: "v1", canDelete: true });
    expect(report.items.map((i) => i.position)).toEqual([0, 1, 2, 3]);
    const drawbacks = report.items.find((i) => i.requirement.includes("drawbacks"))!;
    expect(drawbacks.status).not.toBe("COVERED");
    expect(drawbacks.suggestion).toBeTruthy();
    const sources = report.items.find((i) => i.requirement.includes("peer-reviewed"))!;
    expect(sources).toMatchObject({ status: "MISSING", evidenceQuote: null, evidenceVerified: false });
    expect(sources.suggestion).toBeTruthy();

    const stored = await db.coverageItem.count({ where: { reportId: report.id } });
    expect(stored).toBe(4);
  });

  it("AC1/FR-06: logs COVERAGE_RUN with the title and score", async () => {
    const { team, leader } = await makeTeam();
    const report = await runCoverageCheck(team.id, leader.id, input(), { model: new MockCoverageModel(), now: NOW });
    const events = await db.activityEvent.findMany({ where: { teamId: team.id, type: "COVERAGE_RUN" } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ entityType: "coverage", entityId: report.id, summary: `ran an AI check on “Psych 101 presentation” (score ${report.score})` });
  });

  it("AC2: every stored quote from the mock is verified against the draft", async () => {
    const { team, leader } = await makeTeam();
    const report = await runCoverageCheck(team.id, leader.id, input(), { model: new MockCoverageModel(), now: NOW });
    for (const item of report.items) {
      if (item.evidenceQuote) expect(item.evidenceVerified).toBe(true);
      else expect(item.evidenceVerified).toBe(false);
    }
  });

  it("AC2: an invented quote is kept but flagged, and its COVERED verdict becomes PARTIAL", async () => {
    const { team, leader } = await makeTeam();
    const { model } = fakeModel([
      {
        requirement: "Explain the drawbacks of social media",
        status: "COVERED",
        evidenceQuote: "Heavy use of social media is linked to poorer sleep in teens.", // not in DRAFT
        reason: "The draft discusses sleep.",
        suggestion: null,
      },
      {
        requirement: "Explain the benefits of social media",
        status: "COVERED",
        evidenceQuote: "A 2021 study found benefits for research collaboration", // verbatim
        reason: "Cites a study.",
        suggestion: null,
      },
      {
        requirement: "Conclude with a recommendation",
        status: "PARTIAL",
        evidenceQuote: "We recommend less screen time", // paraphrase
        reason: "Brief.",
        suggestion: "Explain why.",
      },
    ]);
    const report = await runCoverageCheck(team.id, leader.id, input(), { model, now: NOW });
    const [invented, real, paraphrase] = report.items;

    expect(invented).toMatchObject({
      status: "PARTIAL",
      evidenceQuote: "Heavy use of social media is linked to poorer sleep in teens.",
      evidenceVerified: false,
      reason: `${UNVERIFIED_PREFIX}The draft discusses sleep.`,
    });
    expect(invented.suggestion).toBeTruthy();
    expect(real).toMatchObject({ status: "COVERED", evidenceVerified: true, reason: "Cites a study." });
    expect(paraphrase).toMatchObject({ status: "PARTIAL", evidenceVerified: false, reason: "Brief." });
  });

  it("AC2: quotes longer than 300 characters are shortened, and stay verified when they were verbatim", async () => {
    const { team, leader } = await makeTeam();
    const longDraft = `${"Students said the study group helped them understand the lectures. ".repeat(8)}`.trim();
    const { model } = fakeModel([{ requirement: "Describe the study group", status: "COVERED", evidenceQuote: longDraft, reason: "Yes.", suggestion: null }]);
    const report = await runCoverageCheck(team.id, leader.id, input({ draft: longDraft }), { model, now: NOW });
    expect(report.items[0].evidenceQuote!.length).toBeLessThanOrEqual(300);
    expect(report.items[0]).toMatchObject({ status: "COVERED", evidenceVerified: true });
  });

  it("AC8: score = (covered + 0.5 × partial) / n × 100, rounded", async () => {
    const { team, leader } = await makeTeam();
    const item = (status: CoverageModelItem["status"], quote: string | null): CoverageModelItem => ({
      requirement: `R ${Math.random()}`,
      status,
      evidenceQuote: quote,
      reason: "r",
      suggestion: status === "COVERED" ? null : "s",
    });
    const { model } = fakeModel([
      item("COVERED", "Social media helps students stay connected."),
      item("PARTIAL", null),
      item("MISSING", null),
    ]);
    const report = await runCoverageCheck(team.id, leader.id, input(), { model, now: NOW });
    expect(report.score).toBe(50);
    expect(report.counts).toEqual({ COVERED: 1, PARTIAL: 1, MISSING: 1 });
  });

  it("rejects instructions with no checkable requirements (400) without saving anything", async () => {
    const { team, leader } = await makeTeam();
    const { model } = fakeModel([], []);
    await expect(runCoverageCheck(team.id, leader.id, input(), { model, now: NOW })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.coverageReport.count()).toBe(0);
  });

  it("only members can run a check (403)", async () => {
    const { team } = await makeTeam();
    const outsider = await makeUser();
    await expect(runCoverageCheck(team.id, outsider.id, input(), { model: new MockCoverageModel(), now: NOW })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("PB-10 failure handling (AC5)", () => {
  it("AC5: a provider that never answers is cut off, a FAILED report is saved, and the user gets 502 with a clear message", async () => {
    const { team, leader } = await makeTeam();
    const started = Date.now();
    await expect(runCoverageCheck(team.id, leader.id, input(), { model: hangingModel, now: NOW, timeoutMs: 50 })).rejects.toMatchObject({
      code: "UPSTREAM",
      status: 502,
      message: TIMEOUT_MESSAGE,
    });
    expect(Date.now() - started).toBeLessThan(5_000);

    const failed = await db.coverageReport.findFirstOrThrow({ where: { teamId: team.id }, include: { items: true } });
    expect(failed).toMatchObject({ status: "FAILED", score: null, provider: "openai", model: "fake-gpt", promptVersion: "v1" });
    expect(failed.errorMessage).toMatch(/^Timed out after/);
    expect(failed.latencyMs).toBeGreaterThanOrEqual(40);
    expect(failed.items).toHaveLength(0);
    expect(await db.activityEvent.count({ where: { teamId: team.id, type: "COVERAGE_RUN" } })).toBe(0);
  });

  it("AC5: a provider error (missing API key) saves a FAILED report and never logs the draft", async () => {
    const { team, leader } = await makeTeam();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const model: CoverageModel = {
      provider: "openai",
      model: "gpt-5.4-mini",
      extractRequirements: async () => {
        throw new LoadAPIKeyError({ message: "OpenAI API key is missing." });
      },
      checkRequirements: async () => [],
    };
    await expect(runCoverageCheck(team.id, leader.id, input(), { model, now: NOW })).rejects.toMatchObject({
      code: "UPSTREAM",
      message: PROVIDER_ERROR_MESSAGE,
    });
    const failed = await db.coverageReport.findFirstOrThrow({ where: { teamId: team.id } });
    expect(failed).toMatchObject({ status: "FAILED", errorMessage: "The AI provider isn't configured (missing API key)" });
    const logged = errorLog.mock.calls.flat().join(" ");
    expect(logged).not.toContain("Social media helps");
    expect(logged).not.toContain("peer-reviewed");
  });

  it("AC5: the rest of the app keeps working — the FAILED run is listed and the next run succeeds", async () => {
    const { team, leader } = await makeTeam();
    await runCoverageCheck(team.id, leader.id, input({ title: "Will fail" }), { model: hangingModel, now: NOW, timeoutMs: 20 }).catch(() => {});
    const ok = await runCoverageCheck(team.id, leader.id, input({ title: "Works" }), { model: new MockCoverageModel(), now: NOW });
    const list = await listReports(team.id, leader.id);
    expect(list.map((r) => [r.title, r.status])).toEqual([
      ["Works", "COMPLETED"],
      ["Will fail", "FAILED"],
    ]);
    expect(list[1]).toMatchObject({ score: null, counts: { COVERED: 0, PARTIAL: 0, MISSING: 0 } });
    expect(ok.status).toBe("COMPLETED");
  });

  it("AC5: POST returns 502 UPSTREAM in the standard error envelope", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    vi.spyOn(console, "error").mockImplementation(() => {});
    routeModel.current = {
      provider: "openai",
      model: "gpt-5.4-mini",
      extractRequirements: async () => {
        throw new Error("socket hang up");
      },
      checkRequirements: async () => [],
    };
    const res = await callRoute(POST, { params: { teamId: team.id }, body: input() });
    expect(res.status).toBe(502);
    expect(res.json.error).toMatchObject({ code: "UPSTREAM", message: PROVIDER_ERROR_MESSAGE });
    expect(await db.coverageReport.count({ where: { teamId: team.id, status: "FAILED" } })).toBe(1);
  });
});

describe("PB-10 consent, limits, and rate limit", () => {
  it("AC3: without the consent box the request is rejected (400) and nothing is sent to the provider", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    const { model, calls } = fakeModel([]);
    routeModel.current = model;

    const { consent: _omit, ...withoutConsent } = input();
    void _omit;
    for (const body of [withoutConsent, { ...withoutConsent, consent: false }]) {
      const res = await callRoute(POST, { params: { teamId: team.id }, body });
      expect(res.status).toBe(400);
      expect(res.json.error.details.fields.consent).toBe("Please confirm you agree to send this text to the AI provider.");
    }
    expect(calls).toEqual({ extract: 0, check: 0 });
    expect(await db.coverageReport.count()).toBe(0);
  });

  it("AC6: instructions over 15,000 or a draft over 30,000 characters → 400 with the limit in the message", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    const longInstructions = await callRoute(POST, { params: { teamId: team.id }, body: input({ instructions: "a".repeat(15_001) }) });
    expect(longInstructions.status).toBe(400);
    expect(longInstructions.json.error.details.fields.instructions).toContain("15,000");

    const longDraft = await callRoute(POST, { params: { teamId: team.id }, body: input({ draft: "a".repeat(30_001) }) });
    expect(longDraft.status).toBe(400);
    expect(longDraft.json.error.details.fields.draft).toContain("30,000");

    const atLimit = await callRoute(POST, {
      params: { teamId: team.id },
      body: input({ instructions: `- Explain the benefits\n${"a".repeat(14_900)}`, draft: "b".repeat(30_000) }),
    });
    expect(atLimit.status).toBe(201);
  });

  it("AC4: the 11th run in a UTC day returns 429 with a friendly message", async () => {
    const { team, members } = await makeTeam({ members: 1 });
    const me = members[0];
    await insertReports(team.id, me.id, MAX_RUNS_PER_USER_PER_DAY, new Date("2026-10-28T00:00:00Z"));
    expect(await remainingRunsToday(team.id, me.id, NOW)).toBe(0);
    await expect(runCoverageCheck(team.id, me.id, input(), { model: new MockCoverageModel(), now: NOW })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      message: RATE_LIMIT_MESSAGE,
    });
    expect(RATE_LIMIT_MESSAGE).toBe("You've used today's 10 checks. Try again tomorrow.");
  });

  it("AC4: yesterday's runs and other people's runs don't count; the limit resets at 00:00 UTC", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await insertReports(team.id, leader.id, 10, new Date("2026-10-27T23:59:59Z"));
    await insertReports(team.id, members[0].id, 10, NOW);
    expect(await remainingRunsToday(team.id, leader.id, NOW)).toBe(10);
    await insertReports(team.id, leader.id, 3, NOW);
    expect(await remainingRunsToday(team.id, leader.id, NOW)).toBe(7);
    const report = await runCoverageCheck(team.id, leader.id, input(), { model: new MockCoverageModel(), now: NOW });
    expect(report.status).toBe("COMPLETED");
  });

  it("AC4: POST over the limit → 429 RATE_LIMITED envelope", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    await insertReports(team.id, leader.id, 10, new Date());
    const res = await callRoute(POST, { params: { teamId: team.id }, body: input() });
    expect(res.status).toBe(429);
    expect(res.json.error).toEqual({ code: "RATE_LIMITED", message: RATE_LIMIT_MESSAGE });
  });
});

describe("PB-10 list, get, delete", () => {
  it("POST (mock) → 201 report; GET list → summaries newest first; GET one → full report", async () => {
    const { team, members } = await makeTeam({ members: 1 });
    signInAs(members[0]);
    const first = await callRoute(POST, { params: { teamId: team.id }, body: input({ title: "First" }) });
    expect(first.status).toBe(201);
    expect(first.json.data).toMatchObject({ title: "First", status: "COMPLETED", provider: "mock", canDelete: true });
    await callRoute(POST, { params: { teamId: team.id }, body: input({ title: "Second", workType: "REPORT" }) });

    const list = await callRoute(GET, { params: { teamId: team.id } });
    expect(list.status).toBe(200);
    expect(list.json.data.map((r: { title: string }) => r.title)).toEqual(["Second", "First"]);
    expect(list.json.data[1]).toMatchObject({ workType: "PRESENTATION", author: { id: members[0].id }, counts: first.json.data.counts });
    expect(list.json.data[1]).not.toHaveProperty("draft");

    const one = await callRoute(GET_ONE, { params: { teamId: team.id, reportId: first.json.data.id } });
    expect(one.status).toBe(200);
    expect(one.json.data).toMatchObject({ instructions: INSTRUCTIONS, draft: DRAFT, items: first.json.data.items });
  });

  it("a report from another team is 404, not leaked", async () => {
    const a = await makeTeam();
    const b = await makeTeam();
    const report = await runCoverageCheck(a.team.id, a.leader.id, input(), { model: new MockCoverageModel(), now: NOW });
    await expect(getReport(b.team.id, b.leader.id, report.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    signInAs(b.leader);
    expect((await callRoute(GET_ONE, { params: { teamId: b.team.id, reportId: report.id } })).status).toBe(404);
    expect((await callRoute(DELETE, { method: "DELETE", params: { teamId: b.team.id, reportId: report.id } })).status).toBe(404);
  });

  it("AC7: canDelete is true for the author and leaders only", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    const report = await runCoverageCheck(team.id, members[0].id, input(), { model: new MockCoverageModel(), now: NOW });
    expect((await getReport(team.id, members[0].id, report.id)).canDelete).toBe(true);
    expect((await getReport(team.id, leader.id, report.id)).canDelete).toBe(true);
    expect((await getReport(team.id, members[1].id, report.id)).canDelete).toBe(false);
  });

  it("AC7: another member gets 403 and the report stays", async () => {
    const { team, members } = await makeTeam({ members: 2 });
    const report = await runCoverageCheck(team.id, members[0].id, input(), { model: new MockCoverageModel(), now: NOW });
    await expect(deleteReport(team.id, members[1].id, report.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    signInAs(members[1]);
    const res = await callRoute(DELETE, { method: "DELETE", params: { teamId: team.id, reportId: report.id } });
    expect(res.status).toBe(403);
    expect(res.json.error.message).toBe("Only the person who ran this check or a team leader can delete it.");
    expect(await db.coverageReport.count({ where: { id: report.id } })).toBe(1);
  });

  it("AC7: the author permanently deletes a report — items are gone and COVERAGE_DELETED is logged", async () => {
    const { team, members } = await makeTeam({ members: 1 });
    const report = await runCoverageCheck(team.id, members[0].id, input(), { model: new MockCoverageModel(), now: NOW });
    signInAs(members[0]);
    const res = await callRoute(DELETE, { method: "DELETE", params: { teamId: team.id, reportId: report.id } });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ deleted: true });
    expect(await db.coverageReport.count({ where: { id: report.id } })).toBe(0);
    expect(await db.coverageItem.count({ where: { reportId: report.id } })).toBe(0);
    const event = await db.activityEvent.findFirstOrThrow({ where: { teamId: team.id, type: "COVERAGE_DELETED" } });
    expect(event).toMatchObject({ actorId: members[0].id, entityId: report.id, summary: "deleted the AI check “Psych 101 presentation”" });
  });

  it("AC7: a leader can delete a member's report, including a FAILED one", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runCoverageCheck(team.id, members[0].id, input(), { model: hangingModel, now: NOW, timeoutMs: 20 }).catch(() => {});
    const [failed] = await listReports(team.id, leader.id);
    expect(await deleteReport(team.id, leader.id, failed.id)).toEqual({ deleted: true });
    expect(await listReports(team.id, leader.id)).toEqual([]);
  });
});
