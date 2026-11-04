/**
 * PB-14 · FR-09 — group polls. Writes `poll`, `poll_option`, `poll_vote` only.
 *
 * Concurrency: voting and closing lock the poll row (`SELECT … FOR UPDATE`) inside their transaction, so
 * - a vote can't land after the poll closed (vote and close are serialized),
 * - two requests that both find an expired poll (lazy close on list) close it once, log POLL_CLOSED once, and notify once,
 * - a double click or a second tab updates the member's single vote (primary key `(pollId, userId)`), never adds one.
 */
import type { CreatePollInput, PollDTO, VoteInput } from "@/contracts/polls";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/server/activity";
import { db, type DbOrTx, type Tx } from "@/server/db";
import { errors } from "@/server/errors";
import { iso, toUserSummary, userSummarySelect } from "@/server/mappers";
import { notify } from "@/server/notifications";
import { getTeamMemberIds, requireMembership } from "@/server/permissions";
import { closedSummary, pickWinner, tally } from "./results";

export const CLOSED_MESSAGE = "This poll has closed.";
export const PAST_CLOSE_MESSAGE = "Pick a closing time in the future.";

const pollInclude = {
  createdBy: { select: userSummarySelect },
  options: { orderBy: { position: "asc" }, select: { id: true, label: true, position: true } },
  votes: { select: { userId: true, optionId: true } },
} as const;
type PollRow = Prisma.PollGetPayload<{ include: typeof pollInclude }>;

function toPollDTO(row: PollRow, viewerId: string): PollDTO {
  const rows = tally(row.options, row.votes);
  return {
    id: row.id,
    teamId: row.teamId,
    question: row.question,
    closesAt: iso(row.closesAt),
    isClosed: row.closedAt !== null,
    createdBy: toUserSummary(row.createdBy),
    options: rows.map((r) => ({ id: r.optionId, label: r.label, votes: r.votes })),
    myVoteOptionId: row.votes.find((v) => v.userId === viewerId)?.optionId ?? null,
    totalVotes: row.votes.length,
    winningOptionId: row.winningOptionId,
    createdAt: iso(row.createdAt),
  };
}

const pollsLink = (teamId: string) => `/teams/${teamId}/polls`;

/** Locks the poll row for the rest of the transaction; 404 unless it exists in this team. */
async function lockPoll(tx: Tx, teamId: string, pollId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "poll" WHERE id = ${pollId} AND "teamId" = ${teamId} FOR UPDATE`;
  if (rows.length === 0) throw errors.notFound("That poll");
}

async function loadPoll(client: DbOrTx, teamId: string, pollId: string): Promise<PollRow> {
  const row = await client.poll.findFirst({ where: { id: pollId, teamId }, include: pollInclude });
  if (!row) throw errors.notFound("That poll");
  return row;
}

/**
 * Closes a locked, still-open poll: records the winner (AC4), logs POLL_CLOSED with the result (AC3), and notifies the
 * team. `closedById` is the leader/creator who closed it early, or null when the closing time passed (the activity is
 * then attributed to the poll's creator and says "at its closing time").
 */
async function finalize(tx: Tx, teamId: string, pollId: string, closedById: string | null, now: Date): Promise<void> {
  const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId }, include: pollInclude });
  if (poll.closedAt) return; // someone else closed it while we waited for the lock
  const winner = pickWinner(tally(poll.options, poll.votes));
  await tx.poll.update({ where: { id: pollId }, data: { closedAt: now, winningOptionId: winner?.optionId ?? null } });
  const automatic = closedById === null;
  await logActivity(
    {
      teamId,
      actorId: closedById ?? poll.createdById,
      type: "POLL_CLOSED",
      entityType: "poll",
      entityId: pollId,
      summary: closedSummary(poll.question, winner, automatic),
      metadata: { winningOptionId: winner?.optionId ?? null, votes: winner?.votes ?? 0, automatic },
    },
    tx,
  );
  await notify(
    {
      userIds: await getTeamMemberIds(teamId, tx),
      exceptUserId: closedById,
      type: "POLL_CLOSED",
      teamId,
      title: winner ? `Poll closed: “${poll.question}” — ${winner.label} won` : `Poll closed: “${poll.question}” — no winner`,
      link: pollsLink(teamId),
      dedupeKey: `poll-closed:${pollId}`,
    },
    tx,
  );
}

/**
 * Lazily closes every poll in the team whose closing time has passed (no cron, ADR 5). Called by list and vote, so a
 * poll is closed the first time anyone looks after `closesAt`. Safe to run concurrently (row lock + re-check).
 */
export async function closeDuePolls(teamId: string, now: Date = new Date()): Promise<number> {
  const due = await db.poll.findMany({
    where: { teamId, closedAt: null, closesAt: { lte: now } },
    select: { id: true },
  });
  for (const { id } of due) {
    await db.$transaction(async (tx) => {
      await lockPoll(tx, teamId, id);
      await finalize(tx, teamId, id, null, now);
    });
  }
  return due.length;
}

/** Open polls first (closing soonest first), then closed polls (most recently closed first). */
export async function listPolls(teamId: string, actorId: string, now: Date = new Date()): Promise<PollDTO[]> {
  await requireMembership(teamId, actorId);
  await closeDuePolls(teamId, now);
  const rows = await db.poll.findMany({ where: { teamId }, include: pollInclude });
  const open = rows.filter((r) => !r.closedAt).sort((a, b) => a.closesAt.getTime() - b.closesAt.getTime());
  const closed = rows
    .filter((r) => r.closedAt)
    .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
  return [...open, ...closed].map((r) => toPollDTO(r, actorId));
}

/** AC1: 2–6 different options (contract) and a closing time in the future. POLL_CREATED activity; others are notified. */
export async function createPoll(
  teamId: string,
  actorId: string,
  input: CreatePollInput,
  now: Date = new Date(),
): Promise<PollDTO> {
  await requireMembership(teamId, actorId);
  const closesAt = new Date(input.closesAt);
  if (closesAt.getTime() <= now.getTime()) {
    throw errors.validation(PAST_CLOSE_MESSAGE, { fields: { closesAt: PAST_CLOSE_MESSAGE } });
  }
  const row = await db.$transaction(async (tx) => {
    const poll = await tx.poll.create({
      data: {
        teamId,
        question: input.question,
        closesAt,
        createdById: actorId,
        options: { create: input.options.map((label, position) => ({ label, position })) },
      },
      include: pollInclude,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "POLL_CREATED",
        entityType: "poll",
        entityId: poll.id,
        summary: `started the poll “${poll.question}”`,
      },
      tx,
    );
    await notify(
      {
        userIds: await getTeamMemberIds(teamId, tx),
        exceptUserId: actorId,
        type: "POLL_CREATED",
        teamId,
        title: `${poll.createdBy.name} started a poll: “${poll.question}”`,
        link: pollsLink(teamId),
      },
      tx,
    );
    return poll;
  });
  return toPollDTO(row, actorId);
}

/**
 * AC2: one vote per member, changeable until the poll closes; 409 after. Voting for the option you already chose is a
 * no-op. A vote that arrives after `closesAt` closes the poll first (lazy close) and is rejected.
 */
export async function vote(
  teamId: string,
  actorId: string,
  pollId: string,
  input: VoteInput,
  now: Date = new Date(),
): Promise<PollDTO> {
  await requireMembership(teamId, actorId);
  let closedJustNow = false;
  await db.$transaction(async (tx) => {
    await lockPoll(tx, teamId, pollId);
    const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId }, select: { closedAt: true, closesAt: true } });
    if (poll.closedAt) throw errors.conflict(CLOSED_MESSAGE);
    if (poll.closesAt.getTime() <= now.getTime()) {
      await finalize(tx, teamId, pollId, null, now);
      closedJustNow = true;
      return;
    }
    const option = await tx.pollOption.findFirst({ where: { id: input.optionId, pollId }, select: { id: true } });
    if (!option) throw errors.notFound("That option");
    await tx.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: actorId } },
      create: { pollId, userId: actorId, optionId: option.id },
      update: { optionId: option.id },
    });
  });
  // Thrown after the transaction so the lazy close above is committed, not rolled back.
  if (closedJustNow) throw errors.conflict(CLOSED_MESSAGE);
  return toPollDTO(await loadPoll(db, teamId, pollId), actorId);
}

/** AC3: the creator or a leader can close a poll early. 403 for anyone else; 409 if it's already closed. */
export async function closePoll(teamId: string, actorId: string, pollId: string, now: Date = new Date()): Promise<PollDTO> {
  const membership = await requireMembership(teamId, actorId);
  await db.$transaction(async (tx) => {
    await lockPoll(tx, teamId, pollId);
    const poll = await tx.poll.findUniqueOrThrow({ where: { id: pollId }, select: { createdById: true, closedAt: true } });
    if (poll.createdById !== actorId && membership.role !== "LEADER") {
      throw errors.forbidden("Only the person who started this poll or a team leader can close it.");
    }
    if (poll.closedAt) throw errors.conflict("This poll has already closed.");
    await finalize(tx, teamId, pollId, actorId, now);
  });
  return toPollDTO(await loadPoll(db, teamId, pollId), actorId);
}

/** Whether the viewer may close this poll early (used by the page to show the button). */
export function canClosePoll(poll: Pick<PollDTO, "createdBy" | "isClosed">, viewerId: string, viewerIsLeader: boolean) {
  return !poll.isClosed && (poll.createdBy.id === viewerId || viewerIsLeader);
}
