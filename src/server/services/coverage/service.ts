import { APICallError, LoadAPIKeyError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError } from "ai";
import {
  AI_TIMEOUT_MS,
  MAX_RUNS_PER_USER_PER_DAY,
  type CoverageItemDTO,
  type CoverageReportDTO,
  type CoverageReportSummaryDTO,
  type RunCoverageInput,
} from "@/contracts/coverage";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "../../activity";
import { getCoverageModel, type CoverageModel, type CoverageModelItem } from "../../ai";
import { MAX_QUOTE_CHARS, MAX_REQUIREMENTS, PROMPT_VERSION } from "../../ai/prompts";
import { clampQuote, verifyQuote } from "../../ai/quotes";
import { countByStatus, scoreItems } from "../../ai/scoring";
import { db } from "../../db";
import { AppError, errors } from "../../errors";
import { toUserSummary, userSummarySelect } from "../../mappers";
import { requireMembership } from "../../permissions";

/** PB-10 · FR-07, NFR-01, NFR-02, NFR-05 — AI Coverage Check. */

export const UNVERIFIED_PREFIX = "Couldn't find this quote in your draft — ";
export const TIMEOUT_MESSAGE = "The AI service didn't respond in time. Nothing was lost — try again in a minute.";
export const PROVIDER_ERROR_MESSAGE = "The AI service couldn't finish this check. Nothing was lost — try again in a minute.";
export const RATE_LIMIT_MESSAGE = `You've used today's ${MAX_RUNS_PER_USER_PER_DAY} checks. Try again tomorrow.`;

export interface CoverageDeps {
  model: CoverageModel;
  now: Date;
  /** Defaults to AI_TIMEOUT_MS (30 s). Tests pass a few ms to exercise the timeout path. */
  timeoutMs?: number;
}

const summaryInclude = {
  author: { select: userSummarySelect },
  items: { select: { status: true } },
} as const;
const fullInclude = {
  author: { select: userSummarySelect },
  items: { orderBy: { position: "asc" } },
} as const;
type SummaryRow = Prisma.CoverageReportGetPayload<{ include: typeof summaryInclude }>;
type FullRow = Prisma.CoverageReportGetPayload<{ include: typeof fullInclude }>;

function toSummaryDTO(row: SummaryRow | FullRow): CoverageReportSummaryDTO {
  return {
    id: row.id,
    teamId: row.teamId,
    title: row.title,
    workType: row.workType,
    status: row.status,
    score: row.score,
    counts: countByStatus(row.items),
    author: toUserSummary(row.author),
    provider: row.provider,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

function toItemDTO(item: FullRow["items"][number]): CoverageItemDTO {
  return {
    id: item.id,
    position: item.position,
    requirement: item.requirement,
    status: item.status,
    evidenceQuote: item.evidenceQuote,
    evidenceVerified: item.evidenceVerified,
    reason: item.reason,
    suggestion: item.suggestion,
    taskId: item.taskId,
    rating: item.rating,
  };
}

function toReportDTO(row: FullRow, canDelete: boolean): CoverageReportDTO {
  return {
    ...toSummaryDTO(row),
    instructions: row.instructions,
    draft: row.draft,
    errorMessage: row.errorMessage,
    promptVersion: row.promptVersion,
    latencyMs: row.latencyMs,
    items: row.items.map(toItemDTO),
    canDelete,
  };
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function runsToday(actorId: string, now: Date): Promise<number> {
  // Counted per person across all teams, FAILED runs included (they may still have reached the provider).
  return db.coverageReport.count({ where: { authorId: actorId, createdAt: { gte: startOfUtcDay(now) } } });
}

/** "7 of 10 checks left today" on the coverage page. */
export async function remainingRunsToday(teamId: string, actorId: string, now: Date = new Date()): Promise<number> {
  await requireMembership(teamId, actorId);
  return Math.max(0, MAX_RUNS_PER_USER_PER_DAY - (await runsToday(actorId, now)));
}

/** Rejects when `signal` aborts, even if `promise` never settles (a provider that ignores the signal). */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

export interface VerifiedItem extends CoverageModelItem {
  evidenceVerified: boolean;
}

/**
 * AC2: every quote is checked against the draft. An unverified quote is kept (so the team can see what the
 * model claimed) but flagged, and a COVERED verdict that rests on it is downgraded to PARTIAL.
 */
export function verifyItems(items: CoverageModelItem[], draft: string): VerifiedItem[] {
  return items.slice(0, MAX_REQUIREMENTS).map((item) => {
    const quote = item.evidenceQuote?.trim() ? clampQuote(item.evidenceQuote, MAX_QUOTE_CHARS) : null;
    const evidenceVerified = verifyQuote(quote, draft);
    const reason = item.reason.trim() || "No reason given.";
    const suggestion = item.suggestion?.trim() || null;
    if (item.status === "COVERED" && !evidenceVerified) {
      return {
        requirement: item.requirement.trim(),
        status: "PARTIAL",
        evidenceQuote: quote,
        evidenceVerified,
        reason: UNVERIFIED_PREFIX + reason,
        suggestion: suggestion ?? "Point to the part of the draft that covers this, or add it if it isn't there yet.",
      };
    }
    return { requirement: item.requirement.trim(), status: item.status, evidenceQuote: quote, evidenceVerified, reason, suggestion };
  });
}

/**
 * Runs the two-step check and stores the report. Only reached with `consent: true` (the route's Zod schema
 * rejects anything else before this function runs, AC3). Never logs the instructions or the draft.
 */
export async function runCoverageCheck(
  teamId: string,
  actorId: string,
  input: RunCoverageInput,
  deps: Partial<CoverageDeps> = {},
): Promise<CoverageReportDTO> {
  await requireMembership(teamId, actorId);
  const now = deps.now ?? new Date();
  if ((await runsToday(actorId, now)) >= MAX_RUNS_PER_USER_PER_DAY) throw errors.rateLimited(RATE_LIMIT_MESSAGE);

  const model = deps.model ?? getCoverageModel();
  const modelInput = { workType: input.workType, instructions: input.instructions, draft: input.draft };
  const signal = AbortSignal.timeout(deps.timeoutMs ?? AI_TIMEOUT_MS);
  const started = performance.now();
  const base = {
    teamId,
    authorId: actorId,
    title: input.title,
    workType: input.workType,
    instructions: input.instructions,
    draft: input.draft,
    provider: model.provider,
    model: model.model,
    promptVersion: PROMPT_VERSION,
  };

  let items: VerifiedItem[];
  try {
    const requirements = (await untilAborted(model.extractRequirements(modelInput, signal), signal)).slice(0, MAX_REQUIREMENTS);
    if (requirements.length === 0) {
      throw errors.validation("We couldn't find any checkable requirements in the instructions. Paste the full assignment text or rubric.", {
        fields: { instructions: "We couldn't find any requirements here." },
      });
    }
    const checked = await untilAborted(model.checkRequirements(modelInput, requirements, signal), signal);
    if (checked.length === 0) throw new Error("The model returned no items.");
    items = verifyItems(checked, input.draft);
  } catch (err) {
    if (err instanceof AppError) throw err;
    const latencyMs = Math.round(performance.now() - started);
    const timedOut = signal.aborted;
    const errorMessage = timedOut ? `Timed out after ${Math.round(latencyMs / 1000)} s` : describeProviderError(err);
    // Name and status only: provider errors can echo the request body, which contains the draft.
    console.error(`[ai] coverage check failed (${model.provider}/${model.model}): ${errorMessage}`);
    await db.coverageReport.create({ data: { ...base, status: "FAILED", errorMessage, score: null, latencyMs } });
    throw errors.upstream(timedOut ? TIMEOUT_MESSAGE : PROVIDER_ERROR_MESSAGE);
  }

  const latencyMs = Math.round(performance.now() - started);
  const score = scoreItems(items);
  const row = await db.$transaction(async (tx) => {
    const report = await tx.coverageReport.create({
      data: {
        ...base,
        status: "COMPLETED",
        score,
        latencyMs,
        items: { create: items.map((item, position) => ({ position, ...item })) },
      },
      include: fullInclude,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "COVERAGE_RUN",
        entityType: "coverage",
        entityId: report.id,
        summary: `ran an AI check on “${report.title}” (score ${score})`,
        metadata: { score, counts: countByStatus(items) },
      },
      tx,
    );
    return report;
  });
  return toReportDTO(row, true); // the author can always delete their own report
}

/** Short, safe description of a provider failure for `errorMessage` (shown to the team on the FAILED report). */
function describeProviderError(err: unknown): string {
  if (RetryError.isInstance(err)) return describeProviderError(err.lastError);
  if (LoadAPIKeyError.isInstance(err)) return "The AI provider isn't configured (missing API key)";
  if (APICallError.isInstance(err)) return `The AI provider returned an error (HTTP ${err.statusCode ?? "unknown"})`;
  if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) return "The AI returned an answer in the wrong format";
  if (err instanceof Error) return `The AI provider failed (${err.name})`.slice(0, 200);
  return "Unknown error from the AI provider";
}

/** Newest first. FAILED runs are listed too so the team can see what happened. */
export async function listReports(teamId: string, actorId: string): Promise<CoverageReportSummaryDTO[]> {
  await requireMembership(teamId, actorId);
  const rows = await db.coverageReport.findMany({ where: { teamId }, include: summaryInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return rows.map(toSummaryDTO);
}

async function loadInTeam(teamId: string, reportId: string): Promise<FullRow> {
  const row = await db.coverageReport.findUnique({ where: { id: reportId }, include: fullInclude });
  if (!row || row.teamId !== teamId) throw errors.notFound("That report");
  return row;
}

export async function getReport(teamId: string, actorId: string, reportId: string): Promise<CoverageReportDTO> {
  const membership = await requireMembership(teamId, actorId);
  const row = await loadInTeam(teamId, reportId);
  return toReportDTO(row, row.authorId === actorId || membership.role === "LEADER");
}

/** NFR-02: permanent delete (items cascade). Author or leader only (AC7). */
export async function deleteReport(teamId: string, actorId: string, reportId: string): Promise<{ deleted: true }> {
  const membership = await requireMembership(teamId, actorId);
  const row = await loadInTeam(teamId, reportId);
  if (row.authorId !== actorId && membership.role !== "LEADER") {
    throw errors.forbidden("Only the person who ran this check or a team leader can delete it.");
  }
  await db.$transaction(async (tx) => {
    await tx.coverageReport.delete({ where: { id: reportId } });
    await logActivity(
      { teamId, actorId, type: "COVERAGE_DELETED", entityType: "coverage", entityId: reportId, summary: `deleted the AI check “${row.title}”` },
      tx,
    );
  });
  return { deleted: true };
}
