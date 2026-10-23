import { describe, expect, it, vi } from "vitest";
import { POST as joinRoute } from "@/app/api/v1/join/[inviteCode]/route";
import { DELETE as cancelRoute } from "@/app/api/v1/join-requests/[requestId]/route";
import { POST as decisionRoute } from "@/app/api/v1/join-requests/[requestId]/decision/route";
import { POST as requestRoute } from "@/app/api/v1/join-requests/route";
import { POST as acceptRoute } from "@/app/api/v1/me/invites/[inviteId]/accept/route";
import { POST as declineRoute } from "@/app/api/v1/me/invites/[inviteId]/decline/route";
import { GET as myInvitesRoute } from "@/app/api/v1/me/invites/route";
import { GET as myRequestsRoute } from "@/app/api/v1/me/join-requests/route";
import { POST as inviteCodeRoute } from "@/app/api/v1/teams/[teamId]/invite-code/route";
import { POST as invitesRoute } from "@/app/api/v1/teams/[teamId]/invites/route";
import { GET as joinRequestsRoute } from "@/app/api/v1/teams/[teamId]/join-requests/route";
import { DELETE as removeRoute, PATCH as roleRoute } from "@/app/api/v1/teams/[teamId]/members/[userId]/route";
import { GET as getTeamRoute, PATCH as updateTeamRoute } from "@/app/api/v1/teams/[teamId]/route";
import { GET as searchRoute, POST as createRoute } from "@/app/api/v1/teams/route";
import { MAX_TEAM_SIZE } from "@/contracts/teams";
import { db } from "@/server/db";
import { listMyTeams } from "@/server/shared/teams";
import {
  acceptInvite,
  cancelJoinRequest,
  decideJoinRequest,
  getInvitePreview,
  joinByCode,
  myCourses,
  myRoleIn,
  requestToJoin,
} from "@/server/services/teams/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs, signOut } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const activity = (teamId: string) => db.activityEvent.findMany({ where: { teamId }, orderBy: { createdAt: "asc" } });
const notificationsOf = (userId: string) => db.notification.findMany({ where: { userId } });

/** A team with `n` members in total (leader + n − 1). */
async function teamOfSize(n: number, opts: { isOpen?: boolean } = {}) {
  return makeTeam({ members: n - 1, ...opts });
}

describe("PB-04 create, read, update", () => {
  it("AC1: creating a team for “cse6324” stores “CSE 6324”, makes me leader, shows in my sidebar, and logs “created the team”", async () => {
    const me = await makeUser();
    signInAs(me);
    const res = await callRoute(createRoute, { body: { name: "Graph Wizards", courseCode: "cse6324", description: "Algorithms" } });
    expect(res.status).toBe(201);
    const team = res.json.data;
    expect(team).toMatchObject({ name: "Graph Wizards", courseCode: "CSE 6324", isOpen: true, myRole: "LEADER", memberCount: 1 });
    expect(team.inviteCode).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(team.members).toEqual([expect.objectContaining({ role: "LEADER", user: expect.objectContaining({ id: me.id }) })]);
    expect((await listMyTeams(me.id)).map((t) => t.id)).toContain(team.id);
    const events = await activity(team.id);
    expect(events).toEqual([expect.objectContaining({ type: "TEAM_CREATED", actorId: me.id, summary: "created the team" })]);
  });

  it("rejects an invalid team with field errors", async () => {
    signInAs(await makeUser());
    const res = await callRoute(createRoute, { body: { name: "A", courseCode: "" } });
    expect(res.status).toBe(400);
    expect(res.json.error.details.fields).toHaveProperty("name");
    expect(res.json.error.details.fields).toHaveProperty("courseCode");
  });

  it("GET /teams/:id returns members leaders-first with the invite code; non-members get 403", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    signInAs(members[1]);
    const res = await callRoute(getTeamRoute, { params: { teamId: team.id } });
    expect(res.status).toBe(200);
    expect(res.json.data.members[0].user.id).toBe(leader.id);
    expect(res.json.data.members.map((m: { role: string }) => m.role)).toEqual(["LEADER", "MEMBER", "MEMBER"]);
    expect(res.json.data).toMatchObject({ myRole: "MEMBER", inviteCode: team.inviteCode, memberCount: 3 });

    signInAs(await makeUser());
    expect((await callRoute(getTeamRoute, { params: { teamId: team.id } })).status).toBe(403);
  });

  it("PATCH /teams/:id is leader-only, logs TEAM_UPDATED, and a rename keeps a closed team closed", async () => {
    const { team, leader, members } = await makeTeam({ members: 1, isOpen: false });
    signInAs(members[0]);
    expect((await callRoute(updateTeamRoute, { method: "PATCH", params: { teamId: team.id }, body: { name: "Nope" } })).status).toBe(403);

    signInAs(leader);
    const res = await callRoute(updateTeamRoute, { method: "PATCH", params: { teamId: team.id }, body: { name: "Renamed" } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ name: "Renamed", isOpen: false });
    expect((await activity(team.id)).at(-1)).toMatchObject({ type: "TEAM_UPDATED", summary: "renamed the team to “Renamed”" });

    const reopen = await callRoute(updateTeamRoute, { method: "PATCH", params: { teamId: team.id }, body: { isOpen: true } });
    expect(reopen.json.data.isOpen).toBe(true);
    expect((await activity(team.id)).at(-1)).toMatchObject({ summary: "listed the team in course search" });

    const noop = await callRoute(updateTeamRoute, { method: "PATCH", params: { teamId: team.id }, body: { name: "Renamed" } });
    expect(noop.status).toBe(200);
    expect(await activity(team.id)).toHaveLength(2);
  });

  it("page helpers: my courses and my role", async () => {
    const { team, leader } = await makeTeam();
    const stranger = await makeUser({ courses: ["CSE 5311", "CSE 6324"] });
    expect(await myCourses(stranger.id)).toEqual(["CSE 5311", "CSE 6324"]);
    expect(await myRoleIn(team.id, leader.id)).toBe("LEADER");
    expect(await myRoleIn(team.id, stranger.id)).toBeNull();
  });
});

describe("PB-04 course search", () => {
  it("AC3: lists open teams in the course with member counts; closed teams only for their members; filters by name", async () => {
    const { team: open } = await makeTeam({ members: 2, name: "Query Optimizers" });
    const { team: closed, leader: closedLeader } = await makeTeam({ isOpen: false, name: "Secret Squad" });
    await makeTeam({ courseCode: "CSE 5311", name: "Other Course" });
    const viewer = await makeUser();

    signInAs(viewer);
    const res = await callRoute(searchRoute, { query: { course: "cse 6324" } });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual([
      expect.objectContaining({ id: open.id, memberCount: 3, myRole: null, hasPendingRequest: false, isOpen: true }),
    ]);

    signInAs(closedLeader);
    const mine = await callRoute(searchRoute, { query: { course: "CSE 6324" } });
    expect(mine.json.data.map((t: { id: string }) => t.id)).toEqual([closed.id, open.id]); // my team first

    signInAs(viewer);
    const filtered = await callRoute(searchRoute, { query: { course: "CSE 6324", q: "optim" } });
    expect(filtered.json.data.map((t: { name: string }) => t.name)).toEqual(["Query Optimizers"]);
    expect((await callRoute(searchRoute, { query: { course: "CSE 6324", q: "zzz" } })).json.data).toEqual([]);
  });

  it("shows my pending request on the search result", async () => {
    const { team } = await makeTeam();
    const me = await makeUser();
    await requestToJoin(me.id, { teamId: team.id });
    signInAs(me);
    const res = await callRoute(searchRoute, { query: { course: "CSE 6324" } });
    expect(res.json.data[0]).toMatchObject({ id: team.id, hasPendingRequest: true });
  });

  it("requires a course", async () => {
    signInAs(await makeUser());
    expect((await callRoute(searchRoute, { query: {} })).status).toBe(400);
  });
});

describe("PB-04 invite links", () => {
  it("AC2: opening /join/<code> and joining makes me a member; doing it again is harmless", async () => {
    const { team } = await makeTeam();
    const me = await makeUser();
    expect(await getInvitePreview(team.inviteCode, me.id)).toMatchObject({ alreadyMember: false, team: { id: team.id } });

    signInAs(me);
    const first = await callRoute(joinRoute, { params: { inviteCode: team.inviteCode } });
    expect(first.status).toBe(200);
    expect(first.json.data).toMatchObject({ id: team.id, myRole: "MEMBER", memberCount: 2 });
    const again = await callRoute(joinRoute, { params: { inviteCode: team.inviteCode } });
    expect(again.status).toBe(200);
    expect(again.json.data.memberCount).toBe(2);
    expect((await activity(team.id)).filter((e) => e.type === "MEMBER_JOINED")).toHaveLength(1);
    expect(await getInvitePreview(team.inviteCode, me.id)).toMatchObject({ alreadyMember: true });
  });

  it("404s for an unknown code, and rotating the link kills the old one (leader only)", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    signInAs(await makeUser());
    expect((await callRoute(joinRoute, { params: { inviteCode: "nope-nope" } })).status).toBe(404);
    expect(await getInvitePreview("nope-nope", leader.id)).toBeNull();

    signInAs(members[0]);
    expect((await callRoute(inviteCodeRoute, { params: { teamId: team.id } })).status).toBe(403);
    signInAs(leader);
    const res = await callRoute(inviteCodeRoute, { params: { teamId: team.id } });
    expect(res.status).toBe(200);
    expect(res.json.data.inviteCode).not.toBe(team.inviteCode);
    await expect(joinByCode(team.inviteCode, (await makeUser()).id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(joinByCode(res.json.data.inviteCode, (await makeUser()).id)).resolves.toMatchObject({ memberCount: 3 });
  });

  it("joining cancels my pending request and accepts my live invite for that team", async () => {
    const { team, leader } = await makeTeam();
    const me = await makeUser();
    await requestToJoin(me.id, { teamId: team.id });
    await db.teamInvite.create({
      data: { teamId: team.id, email: me.email.toUpperCase(), createdById: leader.id, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await joinByCode(team.inviteCode, me.id);
    expect(await db.joinRequest.findFirst({ where: { userId: me.id } })).toMatchObject({ status: "CANCELLED" });
    expect((await db.teamInvite.findFirst({ where: { teamId: team.id } }))?.acceptedAt).not.toBeNull();
  });
});

describe("PB-04 join requests", () => {
  it("AC4: a non-member can send one request; a second returns 409; leaders get a JOIN_REQUEST notification", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const me = await makeUser({ name: "Olivia" });
    signInAs(me);
    const res = await callRoute(requestRoute, { body: { teamId: team.id, message: "I know SQL" } });
    expect(res.status).toBe(201);
    expect(res.json.data).toMatchObject({ status: "PENDING", message: "I know SQL", team: { id: team.id }, user: { id: me.id } });

    const again = await callRoute(requestRoute, { body: { teamId: team.id } });
    expect(again.status).toBe(409);
    expect(again.json.error.message).toMatch(/already asked/);

    expect(await notificationsOf(leader.id)).toEqual([
      expect.objectContaining({ type: "JOIN_REQUEST", title: `Olivia asked to join “${team.name}”`, link: `/teams/${team.id}/members` }),
    ]);
    expect(await notificationsOf(members[0].id)).toEqual([]); // members who don't lead aren't bothered
    expect((await activity(team.id)).at(-1)).toMatchObject({ type: "JOIN_REQUESTED", actorId: me.id });
  });

  it("rejects requests from members (409), to closed teams (403), to missing teams (404), and with no body (400)", async () => {
    const { team, members } = await makeTeam({ members: 1 });
    const { team: closed } = await makeTeam({ isOpen: false });
    signInAs(members[0]);
    expect((await callRoute(requestRoute, { body: { teamId: team.id } })).status).toBe(409);
    signInAs(await makeUser());
    const closedRes = await callRoute(requestRoute, { body: { teamId: closed.id } });
    expect(closedRes.status).toBe(403);
    expect(closedRes.json.error.message).toMatch(/isn't accepting/);
    expect((await callRoute(requestRoute, { body: { teamId: "missing" } })).status).toBe(404);
    expect((await callRoute(requestRoute, { body: {} })).status).toBe(400);
  });

  it("AC5: a leader approves → the requester becomes a member and is notified; a non-leader gets 403", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const me = await makeUser();
    const request = await requestToJoin(me.id, { teamId: team.id });

    signInAs(members[0]);
    expect((await callRoute(decisionRoute, { params: { requestId: request.id }, body: { decision: "APPROVE" } })).status).toBe(403);
    signInAs(await makeUser());
    expect((await callRoute(decisionRoute, { params: { requestId: request.id }, body: { decision: "APPROVE" } })).status).toBe(403);

    signInAs(leader);
    const pending = await callRoute(joinRequestsRoute, { params: { teamId: team.id } });
    expect(pending.json.data.map((r: { id: string }) => r.id)).toEqual([request.id]);

    const res = await callRoute(decisionRoute, { params: { requestId: request.id }, body: { decision: "APPROVE" } });
    expect(res.status).toBe(200);
    expect(res.json.data).toMatchObject({ status: "APPROVED", decidedAt: expect.any(String) });
    expect(await myRoleIn(team.id, me.id)).toBe("MEMBER");
    expect(await notificationsOf(me.id)).toEqual([
      expect.objectContaining({ type: "JOIN_DECISION", title: `You're in! You joined “${team.name}”`, link: `/teams/${team.id}` }),
    ]);
    expect((await activity(team.id)).slice(-2).map((e) => e.type)).toEqual(["JOIN_APPROVED", "MEMBER_JOINED"]);

    const twice = await callRoute(decisionRoute, { params: { requestId: request.id }, body: { decision: "DECLINE" } });
    expect(twice.status).toBe(409);
    expect((await callRoute(joinRequestsRoute, { params: { teamId: team.id } })).json.data).toEqual([]);
  });

  it("declining notifies the requester and doesn't add them", async () => {
    const { team, leader } = await makeTeam();
    const me = await makeUser();
    const request = await requestToJoin(me.id, { teamId: team.id });
    signInAs(leader);
    const res = await callRoute(decisionRoute, { params: { requestId: request.id }, body: { decision: "DECLINE" } });
    expect(res.json.data.status).toBe("DECLINED");
    expect(await myRoleIn(team.id, me.id)).toBeNull();
    expect((await notificationsOf(me.id))[0]).toMatchObject({ type: "JOIN_DECISION", link: "/teams?course=CSE%206324" });
    expect((await activity(team.id)).at(-1)).toMatchObject({ type: "JOIN_DECLINED" });
    expect((await callRoute(decisionRoute, { params: { requestId: "missing" }, body: { decision: "DECLINE" } })).status).toBe(404);
  });

  it("lists and cancels my own requests; others can't cancel them", async () => {
    const { team } = await makeTeam();
    const me = await makeUser();
    const request = await requestToJoin(me.id, { teamId: team.id });

    signInAs(await makeUser());
    expect((await callRoute(cancelRoute, { method: "DELETE", params: { requestId: request.id } })).status).toBe(404);

    signInAs(me);
    expect((await callRoute(myRequestsRoute)).json.data).toEqual([expect.objectContaining({ id: request.id, status: "PENDING" })]);
    const res = await callRoute(cancelRoute, { method: "DELETE", params: { requestId: request.id } });
    expect(res.json.data).toEqual({ cancelled: true });
    expect((await callRoute(myRequestsRoute)).json.data[0].status).toBe("CANCELLED");
    expect((await callRoute(cancelRoute, { method: "DELETE", params: { requestId: request.id } })).status).toBe(409);
  });
});

describe("PB-04 email invites", () => {
  it("AC6: inviting an existing user notifies them; they accept from /teams; someone else can't (403)", async () => {
    const { team, leader } = await makeTeam({ name: "Core" });
    const invitee = await makeUser({ email: "Invitee@School.edu" });
    const stranger = await makeUser();

    signInAs(leader);
    const res = await callRoute(invitesRoute, {
      params: { teamId: team.id },
      body: { emails: ["invitee@school.edu", "INVITEE@school.edu", "new.person@school.edu"] },
    });
    expect(res.status).toBe(201);
    expect(res.json.data.map((i: { email: string }) => i.email)).toEqual(["invitee@school.edu", "new.person@school.edu"]);
    expect(await notificationsOf(invitee.id)).toEqual([
      expect.objectContaining({ type: "TEAM_INVITE", title: `${leader.name} invited you to join “Core”`, link: "/teams" }),
    ]);
    expect((await activity(team.id)).at(-1)).toMatchObject({
      type: "INVITE_SENT",
      summary: "invited invitee@school.edu and new.person@school.edu",
    });

    signInAs(invitee);
    const mine = await callRoute(myInvitesRoute);
    expect(mine.json.data).toEqual([expect.objectContaining({ team: expect.objectContaining({ id: team.id }) })]);
    const inviteId = mine.json.data[0].id;

    signInAs(stranger);
    const forbidden = await callRoute(acceptRoute, { params: { inviteId } });
    expect(forbidden.status).toBe(403);
    expect(forbidden.json.error.message).toMatch(/different email/);

    signInAs(invitee);
    const accepted = await callRoute(acceptRoute, { params: { inviteId } });
    expect(accepted.status).toBe(200);
    expect(accepted.json.data).toMatchObject({ id: team.id, myRole: "MEMBER" });
    expect((await callRoute(myInvitesRoute)).json.data).toEqual([]);
    expect((await callRoute(acceptRoute, { params: { inviteId } })).status).toBe(200); // accepting twice is harmless
  });

  it("skips members and live invites, is leader-only, and declined or expired invites can't be accepted", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    signInAs(members[0]);
    expect((await callRoute(invitesRoute, { params: { teamId: team.id }, body: { emails: ["x@y.edu"] } })).status).toBe(403);

    signInAs(leader);
    const once = await callRoute(invitesRoute, { params: { teamId: team.id }, body: { emails: ["x@y.edu"] } });
    expect(once.json.data).toHaveLength(1);
    const skipped = await callRoute(invitesRoute, { params: { teamId: team.id }, body: { emails: ["x@y.edu", members[0].email] } });
    expect(skipped.status).toBe(201);
    expect(skipped.json.data).toEqual([]);
    expect((await callRoute(invitesRoute, { params: { teamId: team.id }, body: { emails: ["not-an-email"] } })).status).toBe(400);

    const decliner = await makeUser({ email: "x@y.edu" });
    signInAs(decliner);
    const inviteId = once.json.data[0].id;
    expect((await callRoute(declineRoute, { params: { inviteId } })).json.data).toEqual({ declined: true });
    expect((await callRoute(myInvitesRoute)).json.data).toEqual([]);
    expect((await callRoute(acceptRoute, { params: { inviteId } })).status).toBe(409);
    expect((await callRoute(acceptRoute, { params: { inviteId: "missing" } })).status).toBe(404);

    const late = await db.teamInvite.create({
      data: { teamId: team.id, email: "late@y.edu", createdById: leader.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const lateUser = await makeUser({ email: "late@y.edu" });
    await expect(acceptInvite(late.id, lateUser.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("PB-04 team size (AC7)", () => {
  it(`a full team (${MAX_TEAM_SIZE}) rejects joins, approvals, and invites with a clear 409`, async () => {
    const { team, leader } = await teamOfSize(MAX_TEAM_SIZE);
    const outsider = await makeUser({ email: "outside@school.edu" });

    signInAs(outsider);
    const join = await callRoute(joinRoute, { params: { inviteCode: team.inviteCode } });
    expect(join.status).toBe(409);
    expect(join.json.error.message).toBe(`This team is full (${MAX_TEAM_SIZE} members). Ask a leader to remove someone first.`);
    expect((await callRoute(requestRoute, { body: { teamId: team.id } })).status).toBe(409);

    signInAs(leader);
    expect((await callRoute(invitesRoute, { params: { teamId: team.id }, body: { emails: ["outside@school.edu"] } })).status).toBe(409);

    // A request made before the team filled up can't be approved once it's full.
    const { team: almost, leader: almostLeader } = await teamOfSize(MAX_TEAM_SIZE - 1);
    const early = await requestToJoin(outsider.id, { teamId: almost.id });
    await joinByCode(almost.inviteCode, (await makeUser()).id);
    signInAs(almostLeader);
    expect((await callRoute(decisionRoute, { params: { requestId: early.id }, body: { decision: "APPROVE" } })).status).toBe(409);
    expect(await db.teamMember.count({ where: { teamId: almost.id } })).toBe(MAX_TEAM_SIZE);
  });

  it("concurrent joins can't push a team past the limit (row lock)", async () => {
    const { team } = await teamOfSize(MAX_TEAM_SIZE - 1);
    const users = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const results = await Promise.allSettled(users.map((u) => joinByCode(team.inviteCode, u.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason.code)).toEqual([
      "CONFLICT",
      "CONFLICT",
    ]);
    expect(await db.teamMember.count({ where: { teamId: team.id } })).toBe(MAX_TEAM_SIZE);
  });

  it("a cancel racing an approval: exactly one wins, and the request status matches membership", async () => {
    for (let round = 0; round < 10; round++) {
      const { team, leader } = await makeTeam();
      const me = await makeUser();
      const request = await requestToJoin(me.id, { teamId: team.id });
      const [cancel, approve] = await Promise.allSettled([
        cancelJoinRequest(request.id, me.id),
        decideJoinRequest(request.id, leader.id, { decision: "APPROVE" }),
      ]);
      expect([cancel.status, approve.status].sort()).toEqual(["fulfilled", "rejected"]);
      const loser = (cancel.status === "rejected" ? cancel : approve) as PromiseRejectedResult;
      expect(loser.reason.code).toBe("CONFLICT");
      const stored = await db.joinRequest.findUniqueOrThrow({ where: { id: request.id } });
      const member = (await myRoleIn(team.id, me.id)) !== null;
      expect(stored.status).toBe(member ? "APPROVED" : "CANCELLED");
    }
  });

  it("concurrent duplicate requests create only one PENDING request", async () => {
    const { team } = await makeTeam();
    const me = await makeUser();
    const results = await Promise.allSettled([requestToJoin(me.id, { teamId: team.id }), requestToJoin(me.id, { teamId: team.id })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.joinRequest.count({ where: { teamId: team.id, status: "PENDING" } })).toBe(1);
  });
});

describe("PB-04 roles and leaving (AC8)", () => {
  it("the last leader can't be demoted or leave (409 with an explanation)", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    signInAs(leader);
    const demote = await callRoute(roleRoute, { method: "PATCH", params: { teamId: team.id, userId: leader.id }, body: { role: "MEMBER" } });
    expect(demote.status).toBe(409);
    expect(demote.json.error.message).toMatch(/only leader/);
    const leave = await callRoute(removeRoute, { method: "DELETE", params: { teamId: team.id, userId: leader.id } });
    expect(leave.status).toBe(409);
    expect(leave.json.error.message).toBe("You're the only leader. Make someone else a leader before you leave.");

    // Promote someone, then the original leader can step down and leave.
    const promote = await callRoute(roleRoute, { method: "PATCH", params: { teamId: team.id, userId: members[0].id }, body: { role: "LEADER" } });
    expect(promote.json.data).toMatchObject({ role: "LEADER", user: { id: members[0].id } });
    expect((await activity(team.id)).at(-1)).toMatchObject({ type: "MEMBER_ROLE_CHANGED", summary: `made ${members[0].name} a leader` });
    expect((await callRoute(roleRoute, { method: "PATCH", params: { teamId: team.id, userId: leader.id }, body: { role: "MEMBER" } })).status).toBe(200);
    const left = await callRoute(removeRoute, { method: "DELETE", params: { teamId: team.id, userId: leader.id } });
    expect(left.json.data).toEqual({ removed: true });
    expect((await activity(team.id)).at(-1)).toMatchObject({ type: "MEMBER_LEFT", summary: "left the team" });
  });

  it("leaders remove members (MEMBER_REMOVED); members can only remove themselves; role changes are leader-only", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    signInAs(members[0]);
    expect((await callRoute(removeRoute, { method: "DELETE", params: { teamId: team.id, userId: members[1].id } })).status).toBe(403);
    expect((await callRoute(roleRoute, { method: "PATCH", params: { teamId: team.id, userId: members[0].id }, body: { role: "LEADER" } })).status).toBe(403);

    signInAs(leader);
    const removed = await callRoute(removeRoute, { method: "DELETE", params: { teamId: team.id, userId: members[1].id } });
    expect(removed.status).toBe(200);
    expect((await activity(team.id)).at(-1)).toMatchObject({ type: "MEMBER_REMOVED", summary: `removed ${members[1].name} from the team` });
    expect((await callRoute(removeRoute, { method: "DELETE", params: { teamId: team.id, userId: members[1].id } })).status).toBe(404);
    expect((await callRoute(roleRoute, { method: "PATCH", params: { teamId: team.id, userId: "missing" }, body: { role: "LEADER" } })).status).toBe(404);
    const same = await callRoute(roleRoute, { method: "PATCH", params: { teamId: team.id, userId: members[0].id }, body: { role: "MEMBER" } });
    expect(same.json.data.role).toBe("MEMBER");

    signInAs(members[0]);
    expect((await callRoute(removeRoute, { method: "DELETE", params: { teamId: team.id, userId: members[0].id } })).status).toBe(200);
    expect(await myRoleIn(team.id, members[0].id)).toBeNull();
  });
});

describe("PB-04 authorization (AC9)", () => {
  it("every teams/[teamId] route returns 403 to non-members and 401 when signed out", async () => {
    const { team, leader } = await makeTeam();
    signInAs(await makeUser());
    const params = { teamId: team.id, userId: leader.id };
    expect((await callRoute(getTeamRoute, { params })).status).toBe(403);
    expect((await callRoute(updateTeamRoute, { method: "PATCH", params, body: { name: "x" } })).status).toBe(403);
    expect((await callRoute(invitesRoute, { params, body: { emails: ["a@b.edu"] } })).status).toBe(403);
    expect((await callRoute(inviteCodeRoute, { params })).status).toBe(403);
    expect((await callRoute(joinRequestsRoute, { params })).status).toBe(403);
    expect((await callRoute(roleRoute, { method: "PATCH", params, body: { role: "MEMBER" } })).status).toBe(403);
    expect((await callRoute(removeRoute, { method: "DELETE", params })).status).toBe(403);

    signOut();
    expect((await callRoute(searchRoute, { query: { course: "CSE 6324" } })).status).toBe(401);
    expect((await callRoute(createRoute, { body: { name: "Team", courseCode: "CSE 6324" } })).status).toBe(401);
    expect((await callRoute(myInvitesRoute)).status).toBe(401);
  });
});
