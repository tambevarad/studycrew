import { describe, expect, it, vi } from "vitest";
import { POST as closeRoute } from "@/app/api/v1/teams/[teamId]/polls/[pollId]/close/route";
import { PUT as voteRoute } from "@/app/api/v1/teams/[teamId]/polls/[pollId]/vote/route";
import { GET as listRoute, POST as createRoute } from "@/app/api/v1/teams/[teamId]/polls/route";
import { db } from "@/server/db";
import {
  CLOSED_MESSAGE,
  PAST_CLOSE_MESSAGE,
  canClosePoll,
  closeDuePolls,
  closePoll,
  createPoll,
  listPolls,
  vote,
} from "@/server/services/polls/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

/**
 * Everything is relative to one `now` captured at load: polls close 60 min later, and the lazy-close tests pass an
 * explicit later `now`. Route calls use the real clock, which stays within seconds of NOW, so no test depends on the
 * date, weekday, or time of day it runs.
 */
const NOW = new Date();
const at = (minutesFromNow: number) => new Date(NOW.getTime() + minutesFromNow * 60_000);
const iso = (d: Date) => d.toISOString();

const activity = (teamId: string, type: string) => db.activityEvent.findMany({ where: { teamId, type } });
const notes = (type: "POLL_CREATED" | "POLL_CLOSED", teamId: string) =>
  db.notification.findMany({ where: { teamId, type }, orderBy: { userId: "asc" } });

async function setup(members = 2) {
  const t = await makeTeam({ members });
  const poll = await createPoll(
    t.team.id,
    t.leader.id,
    { question: "Where do we meet?", options: ["Library", "Zoom", "Cafe"], closesAt: iso(at(60)) },
    NOW,
  );
  const opt = (label: string) => poll.options.find((o) => o.label === label)!.id;
  return { ...t, poll, opt };
}

describe("PB-14 create", () => {
  it("AC1: a poll needs 2–6 distinct options and a future closing time (400 with field errors)", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    const body = (over: Record<string, unknown>) => ({
      question: "Topic?",
      options: ["A", "B"],
      closesAt: iso(new Date(Date.now() + 86_400_000)),
      ...over,
    });
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ options: ["Only one"] }, "options"],
      [{ options: ["1", "2", "3", "4", "5", "6", "7"] }, "options"],
      [{ options: ["Zoom", "zoom"] }, "options"],
      [{ question: "" }, "question"],
      [{ closesAt: "tomorrow" }, "closesAt"],
    ];
    for (const [over, field] of cases) {
      const res = await callRoute(createRoute, { params: { teamId: team.id }, body: body(over) });
      expect(res.status, JSON.stringify(over)).toBe(400);
      expect(res.json.error.details.fields, JSON.stringify(over)).toHaveProperty(field);
    }
    const past = await callRoute(createRoute, {
      params: { teamId: team.id },
      body: body({ closesAt: iso(new Date(Date.now() - 60_000)) }),
    });
    expect(past.status).toBe(400);
    expect(past.json.error.details.fields.closesAt).toBe(PAST_CLOSE_MESSAGE);

    const ok = await callRoute(createRoute, { params: { teamId: team.id }, body: body({ options: ["A", "B", "C", "D", "E", "F"] }) });
    expect(ok.status).toBe(201);
    expect(ok.json.data).toMatchObject({ question: "Topic?", isClosed: false, totalVotes: 0, myVoteOptionId: null, winningOptionId: null });
    expect(ok.json.data.options.map((o: { label: string }) => o.label)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("logs POLL_CREATED and notifies the other members, not the creator", async () => {
    const { team, leader, members, poll } = await setup(2);
    expect(await activity(team.id, "POLL_CREATED")).toEqual([
      expect.objectContaining({ actorId: leader.id, entityId: poll.id, summary: "started the poll “Where do we meet?”" }),
    ]);
    const n = await notes("POLL_CREATED", team.id);
    expect(n.map((x) => x.userId).sort()).toEqual(members.map((m) => m.id).sort());
    expect(n[0]).toMatchObject({ link: `/teams/${team.id}/polls`, title: `${leader.name} started a poll: “Where do we meet?”` });
  });
});

describe("PB-14 voting", () => {
  it("AC2: each member has one vote that can change until the poll closes", async () => {
    const { team, members, poll, opt } = await setup(2);
    signInAs(members[0]);
    const first = await callRoute(voteRoute, { method: "PUT", params: { teamId: team.id, pollId: poll.id }, body: { optionId: opt("Zoom") } });
    expect(first.status).toBe(200);
    expect(first.json.data).toMatchObject({ myVoteOptionId: opt("Zoom"), totalVotes: 1 });

    const changed = await callRoute(voteRoute, { method: "PUT", params: { teamId: team.id, pollId: poll.id }, body: { optionId: opt("Cafe") } });
    expect(changed.json.data).toMatchObject({ myVoteOptionId: opt("Cafe"), totalVotes: 1 });
    expect(changed.json.data.options).toEqual([
      expect.objectContaining({ label: "Library", votes: 0 }),
      expect.objectContaining({ label: "Zoom", votes: 0 }),
      expect.objectContaining({ label: "Cafe", votes: 1 }),
    ]);
    expect(await db.pollVote.count({ where: { pollId: poll.id } })).toBe(1);
  });

  it("AC2: after closing, voting returns 409 “This poll has closed.”", async () => {
    const { team, leader, members, poll, opt } = await setup(1);
    await closePoll(team.id, leader.id, poll.id, at(5));
    signInAs(members[0]);
    const res = await callRoute(voteRoute, { method: "PUT", params: { teamId: team.id, pollId: poll.id }, body: { optionId: opt("Zoom") } });
    expect(res.status).toBe(409);
    expect(res.json.error.message).toBe(CLOSED_MESSAGE);
  });

  it("AC2: a vote after the closing time closes the poll (lazy) and is rejected", async () => {
    const { team, members, poll, opt } = await setup(1);
    await expect(vote(team.id, members[0].id, poll.id, { optionId: opt("Zoom") }, at(61))).rejects.toMatchObject({
      code: "CONFLICT",
      message: CLOSED_MESSAGE,
    });
    const stored = await db.poll.findUniqueOrThrow({ where: { id: poll.id } });
    expect(stored.closedAt).not.toBeNull();
    expect(await db.pollVote.count({ where: { pollId: poll.id } })).toBe(0);
    expect(await activity(team.id, "POLL_CLOSED")).toHaveLength(1);
  });

  it("rejects an option from another poll (404) and polls from another team (404)", async () => {
    const a = await setup(1);
    const b = await setup(1);
    await expect(vote(a.team.id, a.members[0].id, a.poll.id, { optionId: b.opt("Zoom") }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(vote(a.team.id, a.members[0].id, b.poll.id, { optionId: b.opt("Zoom") }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(closePoll(a.team.id, a.leader.id, b.poll.id, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a double click or two tabs never create two votes (concurrent PUTs)", async () => {
    const { team, members, poll, opt } = await setup(1);
    const me = members[0].id;
    const results = await Promise.allSettled([
      vote(team.id, me, poll.id, { optionId: opt("Library") }, NOW),
      vote(team.id, me, poll.id, { optionId: opt("Zoom") }, NOW),
      vote(team.id, me, poll.id, { optionId: opt("Library") }, NOW),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await db.pollVote.count({ where: { pollId: poll.id, userId: me } })).toBe(1);
  });

  it("a vote racing an early close: either it counts before the close or it gets 409; never after", async () => {
    for (let round = 0; round < 5; round++) {
      const { team, leader, members, poll, opt } = await setup(1);
      const [v] = await Promise.allSettled([
        vote(team.id, members[0].id, poll.id, { optionId: opt("Zoom") }, NOW),
        closePoll(team.id, leader.id, poll.id, NOW),
      ]);
      const stored = await db.poll.findUniqueOrThrow({ where: { id: poll.id } });
      const votes = await db.pollVote.count({ where: { pollId: poll.id } });
      if (v.status === "fulfilled") {
        expect(votes).toBe(1);
        expect(stored.winningOptionId).toBe(opt("Zoom")); // the close saw the vote
      } else {
        expect((v as PromiseRejectedResult).reason.code).toBe("CONFLICT");
        expect(votes).toBe(0);
        expect(stored.winningOptionId).toBeNull();
      }
    }
  });
});

describe("PB-14 closing", () => {
  it("AC3: closing early records the winner in activity and notifies members (not the closer)", async () => {
    const { team, leader, members, poll, opt } = await setup(2);
    await vote(team.id, members[0].id, poll.id, { optionId: opt("Zoom") }, NOW);
    await vote(team.id, members[1].id, poll.id, { optionId: opt("Zoom") }, NOW);
    await vote(team.id, leader.id, poll.id, { optionId: opt("Cafe") }, NOW);

    signInAs(leader);
    const res = await callRoute(closeRoute, { params: { teamId: team.id, pollId: poll.id } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ isClosed: true, winningOptionId: opt("Zoom"), totalVotes: 3 });

    expect(await activity(team.id, "POLL_CLOSED")).toEqual([
      expect.objectContaining({ actorId: leader.id, summary: "closed the poll “Where do we meet?” — winner: “Zoom” (2 votes)" }),
    ]);
    const n = await notes("POLL_CLOSED", team.id);
    expect(n.map((x) => x.userId).sort()).toEqual(members.map((m) => m.id).sort());
    expect(n[0]).toMatchObject({ title: "Poll closed: “Where do we meet?” — Zoom won", link: `/teams/${team.id}/polls` });
  });

  it("AC3: a poll past its closing time is closed lazily on the next list, with the result in activity", async () => {
    const { team, leader, members, poll, opt } = await setup(1);
    await vote(team.id, members[0].id, poll.id, { optionId: opt("Library") }, NOW);
    const before = await listPolls(team.id, members[0].id, at(30));
    expect(before[0]).toMatchObject({ isClosed: false });

    const after = await listPolls(team.id, members[0].id, at(61));
    expect(after[0]).toMatchObject({ isClosed: true, winningOptionId: opt("Library") });
    expect(await activity(team.id, "POLL_CLOSED")).toEqual([
      expect.objectContaining({
        actorId: leader.id,
        summary: "closed the poll “Where do we meet?” at its closing time — winner: “Library” (1 vote)",
      }),
    ]);
    // Everyone is notified for an automatic close, including the creator.
    expect((await notes("POLL_CLOSED", team.id)).map((x) => x.userId).sort()).toEqual([leader.id, members[0].id].sort());
  });

  it("AC3: concurrent lazy closes close once, log once, and notify once", async () => {
    const { team, leader, members, poll } = await setup(2);
    await Promise.all([closeDuePolls(team.id, at(61)), closeDuePolls(team.id, at(61)), listPolls(team.id, leader.id, at(61))]);
    expect(await activity(team.id, "POLL_CLOSED")).toHaveLength(1);
    expect(await db.notification.count({ where: { teamId: team.id, type: "POLL_CLOSED" } })).toBe(1 + members.length);
    expect((await db.poll.findUniqueOrThrow({ where: { id: poll.id } })).closedAt).not.toBeNull();
  });

  it("AC4: ties go to the option listed first; no votes → no winner", async () => {
    const tie = await setup(1);
    await vote(tie.team.id, tie.leader.id, tie.poll.id, { optionId: tie.opt("Cafe") }, NOW);
    await vote(tie.team.id, tie.members[0].id, tie.poll.id, { optionId: tie.opt("Zoom") }, NOW);
    const closed = await closePoll(tie.team.id, tie.leader.id, tie.poll.id, NOW);
    expect(closed.winningOptionId).toBe(tie.opt("Zoom")); // Zoom is listed before Cafe

    const empty = await setup(1);
    const none = await closePoll(empty.team.id, empty.leader.id, empty.poll.id, NOW);
    expect(none).toMatchObject({ isClosed: true, winningOptionId: null, totalVotes: 0 });
    expect((await activity(empty.team.id, "POLL_CLOSED"))[0].summary).toBe("closed the poll “Where do we meet?” — no winner (no votes)");
    expect((await notes("POLL_CLOSED", empty.team.id))[0].title).toBe("Poll closed: “Where do we meet?” — no winner");
  });

  it("only the creator or a leader can close early (403); closing twice is 409", async () => {
    const { team, leader, members, poll } = await setup(2);
    signInAs(members[0]);
    const denied = await callRoute(closeRoute, { params: { teamId: team.id, pollId: poll.id } });
    expect(denied.status).toBe(403);
    expect(denied.json.error.message).toMatch(/started this poll or a team leader/);

    // A member who created their own poll can close it.
    const own = await createPoll(team.id, members[0].id, { question: "Snacks?", options: ["Yes", "No"], closesAt: iso(at(60)) }, NOW);
    await expect(closePoll(team.id, members[0].id, own.id, NOW)).resolves.toMatchObject({ isClosed: true });

    await closePoll(team.id, leader.id, poll.id, NOW);
    await expect(closePoll(team.id, leader.id, poll.id, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("canClosePoll: creator or leader, only while open", async () => {
    const { leader, members, poll } = await setup(1);
    expect(canClosePoll(poll, leader.id, true)).toBe(true);
    expect(canClosePoll(poll, members[0].id, false)).toBe(false);
    expect(canClosePoll({ ...poll, isClosed: true }, leader.id, true)).toBe(false);
  });
});

describe("PB-14 list and authorization", () => {
  it("GET lists open polls first (closing soonest), then closed (most recently closed)", async () => {
    const { team, leader } = await makeTeam();
    const mk = (q: string, mins: number) =>
      createPoll(team.id, leader.id, { question: q, options: ["A", "B"], closesAt: iso(new Date(Date.now() + mins * 60_000)) });
    const later = await mk("Later", 300);
    const sooner = await mk("Sooner", 100);
    const closedOld = await mk("Closed first", 200);
    const closedNew = await mk("Closed second", 200);
    await closePoll(team.id, leader.id, closedOld.id, new Date(Date.now() - 1000));
    await closePoll(team.id, leader.id, closedNew.id, new Date());

    signInAs(leader);
    const res = await callRoute(listRoute, { params: { teamId: team.id } });
    expect(res.status).toBe(200);
    expect(res.json.data.map((p: { id: string }) => p.id)).toEqual([sooner.id, later.id, closedNew.id, closedOld.id]);
  });

  it("non-members get 403 on every poll route", async () => {
    const { team, poll, opt } = await setup(1);
    signInAs(await makeUser());
    const p = { teamId: team.id, pollId: poll.id };
    expect((await callRoute(listRoute, { params: p })).status).toBe(403);
    expect((await callRoute(createRoute, { params: p, body: { question: "x", options: ["a", "b"], closesAt: iso(at(60)) } })).status).toBe(403);
    expect((await callRoute(voteRoute, { method: "PUT", params: p, body: { optionId: opt("Zoom") } })).status).toBe(403);
    expect((await callRoute(closeRoute, { params: p })).status).toBe(403);
  });
});
