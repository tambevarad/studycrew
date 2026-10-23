/**
 * PB-04 · FR-02 — Teams, invites, course search, join requests, roles.
 * Writes `team`, `team_member`, `team_invite`, `join_request` only.
 *
 * Concurrency: every write that can add a member, add a pending request, or remove a leader first locks the team row
 * (`SELECT … FOR UPDATE`) inside its transaction and re-checks the rule there. The schema has no partial unique index
 * for "one PENDING request" or a row limit for "8 members", so without the lock two simultaneous requests could both
 * pass the check (e.g. a 9th member joining by link while a leader approves a request).
 */
import {
  MAX_TEAM_SIZE,
  type ChangeRoleInput,
  type CreateJoinRequestInput,
  type CreateTeamInput,
  type DecideJoinRequestInput,
  type InviteByEmailInput,
  type JoinRequestDTO,
  type SearchTeamsQuery,
  type TeamDetailDTO,
  type TeamInviteDTO,
  type TeamMemberDTO,
  type TeamRoleValue,
  type TeamSummaryDTO,
  type UpdateTeamInput,
} from "@/contracts/teams";
import { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/server/activity";
import { db, type DbOrTx, type Tx } from "@/server/db";
import { errors } from "@/server/errors";
import { iso, toUserSummary, userSummarySelect } from "@/server/mappers";
import { notify } from "@/server/notifications";
import { requireLeader, requireMembership } from "@/server/permissions";
import {
  generateInviteCode,
  inviteExpiry,
  isFull,
  isInviteLive,
  normalizeEmails,
  sortMembers,
  summarizeList,
  wouldRemoveLastLeader,
} from "./rules";

const FULL_MESSAGE = `This team is full (${MAX_TEAM_SIZE} members). Ask a leader to remove someone first.`;
const teamRef = { id: true, name: true, courseCode: true } as const;

// ───────────────────────────── mapping ─────────────────────────────

const memberInclude = { user: { select: userSummarySelect } } as const;
type MemberRow = Prisma.TeamMemberGetPayload<{ include: typeof memberInclude }>;

function toMemberDTO(m: MemberRow): TeamMemberDTO {
  return { user: toUserSummary(m.user), role: m.role, joinedAt: iso(m.joinedAt) };
}

const joinRequestInclude = { team: { select: teamRef }, user: { select: userSummarySelect } } as const;
type JoinRequestRow = Prisma.JoinRequestGetPayload<{ include: typeof joinRequestInclude }>;

function toJoinRequestDTO(r: JoinRequestRow): JoinRequestDTO {
  return {
    id: r.id,
    team: r.team,
    user: toUserSummary(r.user),
    message: r.message,
    status: r.status,
    createdAt: iso(r.createdAt),
    decidedAt: iso(r.decidedAt),
  };
}

const inviteInclude = { team: { select: teamRef }, createdBy: { select: userSummarySelect } } as const;
type InviteRow = Prisma.TeamInviteGetPayload<{ include: typeof inviteInclude }>;

function toInviteDTO(i: InviteRow): TeamInviteDTO {
  return {
    id: i.id,
    team: i.team,
    email: i.email,
    invitedBy: toUserSummary(i.createdBy),
    createdAt: iso(i.createdAt),
    expiresAt: iso(i.expiresAt),
  };
}

/** Full team view for a member (the viewer's role decides nothing here; routes/pages already checked membership). */
async function loadDetail(teamId: string, viewerId: string, client: DbOrTx = db): Promise<TeamDetailDTO> {
  const team = await client.team.findUnique({
    where: { id: teamId },
    include: { members: { include: memberInclude } },
  });
  if (!team) throw errors.notFound("That team");
  const me = team.members.find((m) => m.userId === viewerId);
  return {
    id: team.id,
    name: team.name,
    courseCode: team.courseCode,
    description: team.description,
    isOpen: team.isOpen,
    memberCount: team.members.length,
    myRole: me?.role ?? null,
    hasPendingRequest: false,
    inviteCode: me ? team.inviteCode : null,
    members: sortMembers(team.members).map(toMemberDTO),
    createdAt: iso(team.createdAt),
  };
}

// ───────────────────────────── shared write steps ─────────────────────────────

/** Locks the team row for the rest of the transaction (see the file comment). 404 if it doesn't exist. */
async function lockTeam(tx: Tx, teamId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "team" WHERE id = ${teamId} FOR UPDATE`;
  if (rows.length === 0) throw errors.notFound("That team");
}

async function assertRoom(tx: Tx, teamId: string): Promise<void> {
  if (isFull(await tx.teamMember.count({ where: { teamId } }))) throw errors.conflict(FULL_MESSAGE);
}

/**
 * Adds `userId` to a locked team as a MEMBER and logs MEMBER_JOINED. Also tidies up anything that led here: their
 * PENDING join requests become CANCELLED (so leaders don't see stale requests) and their live invites become accepted.
 * Returns false (and changes nothing) if they were already a member.
 */
async function addMember(tx: Tx, teamId: string, userId: string, now: Date): Promise<boolean> {
  const existing = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  if (existing) return false;
  await assertRoom(tx, teamId);
  await tx.teamMember.create({ data: { teamId, userId, role: "MEMBER" } });
  await tx.joinRequest.updateMany({
    where: { teamId, userId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: now },
  });
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await tx.teamInvite.updateMany({
    where: {
      teamId,
      email: { equals: user.email, mode: "insensitive" },
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { acceptedAt: now },
  });
  await logActivity(
    { teamId, actorId: userId, type: "MEMBER_JOINED", entityType: "member", entityId: userId, summary: "joined the team" },
    tx,
  );
  return true;
}

async function leaderIds(client: DbOrTx, teamId: string): Promise<string[]> {
  const rows = await client.teamMember.findMany({ where: { teamId, role: "LEADER" }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Runs `create` with a fresh invite code, retrying if the unique index reports a collision. */
async function withUniqueInviteCode<T>(create: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await create(generateInviteCode());
    } catch (err) {
      const collision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        JSON.stringify(err.meta ?? {}).includes("inviteCode");
      if (!collision || attempt >= 5) throw err;
    }
  }
}

// ───────────────────────────── teams ─────────────────────────────

/** AC1: the creator becomes the only LEADER; the course code arrives normalized from the contract ("cse6324" → "CSE 6324"). */
export async function createTeam(actorId: string, input: CreateTeamInput): Promise<TeamDetailDTO> {
  const teamId = await withUniqueInviteCode((inviteCode) =>
    db.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: input.name,
          courseCode: input.courseCode,
          description: input.description || null,
          isOpen: input.isOpen ?? true,
          inviteCode,
          createdById: actorId,
          members: { create: { userId: actorId, role: "LEADER" } },
        },
        select: { id: true },
      });
      await logActivity(
        { teamId: team.id, actorId, type: "TEAM_CREATED", entityType: "team", entityId: team.id, summary: "created the team" },
        tx,
      );
      return team.id;
    }),
  );
  return loadDetail(teamId, actorId);
}

/**
 * AC3: open teams in the course plus any team the viewer is already in for that course (closed teams stay hidden
 * from everyone else). Optional case-insensitive name filter. The viewer's own teams come first, then by name.
 */
export async function searchTeams(viewerId: string, query: SearchTeamsQuery): Promise<TeamSummaryDTO[]> {
  const q = query.q?.trim();
  const rows = await db.team.findMany({
    where: {
      courseCode: query.course,
      OR: [{ isOpen: true }, { members: { some: { userId: viewerId } } }],
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: viewerId }, select: { role: true } },
      joinRequests: { where: { userId: viewerId, status: "PENDING" }, select: { id: true } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });
  const summaries = rows.map(
    (t): TeamSummaryDTO => ({
      id: t.id,
      name: t.name,
      courseCode: t.courseCode,
      description: t.description,
      isOpen: t.isOpen,
      memberCount: t._count.members,
      myRole: t.members[0]?.role ?? null,
      hasPendingRequest: t.joinRequests.length > 0,
    }),
  );
  return summaries.sort((a, b) => Number(b.myRole !== null) - Number(a.myRole !== null));
}

export async function getTeam(teamId: string, viewerId: string): Promise<TeamDetailDTO> {
  await requireMembership(teamId, viewerId);
  return loadDetail(teamId, viewerId);
}

/** Leader only. Only the fields present in `input` change. */
export async function updateTeam(teamId: string, actorId: string, input: UpdateTeamInput): Promise<TeamDetailDTO> {
  await requireLeader(teamId, actorId);
  const before = await db.team.findUniqueOrThrow({ where: { id: teamId } });
  const description = input.description === undefined ? undefined : input.description || null;
  const changed: string[] = [];
  if (input.name !== undefined && input.name !== before.name) changed.push("name");
  if (input.courseCode !== undefined && input.courseCode !== before.courseCode) changed.push("course");
  if (description !== undefined && description !== before.description) changed.push("description");
  if (input.isOpen !== undefined && input.isOpen !== before.isOpen) changed.push("visibility");

  await db.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: teamId },
      data: { name: input.name, courseCode: input.courseCode, description, isOpen: input.isOpen },
    });
    if (changed.length === 0) return;
    const summary =
      changed.length === 1 && changed[0] === "name"
        ? `renamed the team to “${input.name}”`
        : changed.length === 1 && changed[0] === "visibility"
          ? input.isOpen
            ? "listed the team in course search"
            : "hid the team from course search"
          : `updated the team's ${summarizeList(changed, 4)}`;
    await logActivity(
      { teamId, actorId, type: "TEAM_UPDATED", entityType: "team", entityId: teamId, summary, metadata: { fields: changed } },
      tx,
    );
  });
  return loadDetail(teamId, actorId);
}

/** Leader only. The old /join/<code> link stops working immediately. */
export async function rotateInviteCode(teamId: string, actorId: string): Promise<{ inviteCode: string }> {
  await requireLeader(teamId, actorId);
  return withUniqueInviteCode(async (inviteCode) => {
    await db.team.update({ where: { id: teamId }, data: { inviteCode } });
    return { inviteCode };
  });
}

// ───────────────────────────── invite links ─────────────────────────────

/** For the /join/<code> page: what the link points at, and whether the viewer is already in. Null for a bad code. */
export async function getInvitePreview(
  inviteCode: string,
  viewerId: string,
): Promise<{ team: TeamSummaryDTO; alreadyMember: boolean } | null> {
  const team = await db.team.findUnique({
    where: { inviteCode },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: viewerId }, select: { role: true } },
    },
  });
  if (!team) return null;
  const myRole = team.members[0]?.role ?? null;
  return {
    team: {
      id: team.id,
      name: team.name,
      courseCode: team.courseCode,
      description: team.description,
      isOpen: team.isOpen,
      memberCount: team._count.members,
      myRole,
      hasPendingRequest: false,
    },
    alreadyMember: myRole !== null,
  };
}

/** AC2: idempotent; 404 for an unknown or rotated code; 409 when full (AC7). Works for closed teams too (it's an invite). */
export async function joinByCode(inviteCode: string, userId: string): Promise<TeamDetailDTO> {
  const team = await db.team.findUnique({ where: { inviteCode }, select: { id: true } });
  if (!team) throw errors.notFound("That invite link");
  await db.$transaction(async (tx) => {
    await lockTeam(tx, team.id);
    await addMember(tx, team.id, userId, new Date());
  });
  return loadDetail(team.id, userId);
}

// ───────────────────────────── email invites ─────────────────────────────

/**
 * Leader only (AC6). Skips current members and emails that already have a live invite; returns the invites created.
 * Existing users with those emails get a TEAM_INVITE notification; email delivery is out of scope.
 */
export async function inviteByEmail(
  teamId: string,
  actorId: string,
  input: InviteByEmailInput,
  now: Date = new Date(),
): Promise<TeamInviteDTO[]> {
  await requireLeader(teamId, actorId);
  const emails = normalizeEmails(input.emails);
  const created = await db.$transaction(async (tx) => {
    await lockTeam(tx, teamId);
    await assertRoom(tx, teamId);
    const team = await tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: {
        name: true,
        members: { select: { user: { select: { email: true } } } },
        invites: { where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, select: { email: true } },
      },
    });
    const skip = new Set([
      ...team.members.map((m) => m.user.email.toLowerCase()),
      ...team.invites.map((i) => i.email.toLowerCase()),
    ]);
    const fresh = emails.filter((e) => !skip.has(e));
    if (fresh.length === 0) return [];

    const rows: InviteRow[] = [];
    for (const email of fresh) {
      rows.push(
        await tx.teamInvite.create({
          data: { teamId, email, createdById: actorId, expiresAt: inviteExpiry(now) },
          include: inviteInclude,
        }),
      );
    }
    await logActivity(
      {
        teamId,
        actorId,
        type: "INVITE_SENT",
        entityType: "team",
        entityId: teamId,
        summary: `invited ${summarizeList(fresh)}`,
        metadata: { count: fresh.length },
      },
      tx,
    );
    const invitees = await tx.user.findMany({
      where: { OR: fresh.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
      select: { id: true },
    });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { name: true } });
    await notify(
      {
        userIds: invitees.map((u) => u.id),
        exceptUserId: actorId,
        type: "TEAM_INVITE",
        teamId,
        title: `${actor.name} invited you to join “${team.name}”`,
        link: "/teams",
      },
      tx,
    );
    return rows;
  });
  return created.map(toInviteDTO);
}

async function myEmail(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw errors.notFound("Your account");
  return user.email;
}

/** Pending, unexpired invites to my email for teams I'm not already in. */
export async function listMyInvites(userId: string, now: Date = new Date()): Promise<TeamInviteDTO[]> {
  const email = await myEmail(userId);
  const rows = await db.teamInvite.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
      team: { members: { none: { userId } } },
    },
    include: inviteInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toInviteDTO);
}

/** Loads an invite addressed to this user: 404 if it doesn't exist, 403 if it's someone else's (AC6). */
async function myInvite(inviteId: string, userId: string) {
  const invite = await db.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite) throw errors.notFound("That invitation");
  if (invite.email.toLowerCase() !== (await myEmail(userId)).toLowerCase()) {
    throw errors.forbidden("This invitation was sent to a different email address.");
  }
  return invite;
}

export async function acceptInvite(inviteId: string, userId: string, now: Date = new Date()): Promise<TeamDetailDTO> {
  const invite = await myInvite(inviteId, userId);
  await db.$transaction(async (tx) => {
    await lockTeam(tx, invite.teamId);
    const fresh = await tx.teamInvite.findUniqueOrThrow({ where: { id: inviteId } });
    const alreadyMember = await tx.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId } },
    });
    if (alreadyMember) return; // accepting twice, or joined by link meanwhile: harmless
    if (!isInviteLive(fresh, now)) {
      throw errors.conflict("This invitation has expired or was withdrawn. Ask the team leader for a new one.");
    }
    await addMember(tx, invite.teamId, userId, now); // also marks this invite accepted
  });
  return loadDetail(invite.teamId, userId);
}

/** The schema has no `declinedAt`, so a declined invite is stored as revoked (it simply stops being live). */
export async function declineInvite(inviteId: string, userId: string, now: Date = new Date()): Promise<{ declined: true }> {
  const invite = await myInvite(inviteId, userId);
  if (isInviteLive(invite, now)) {
    await db.teamInvite.update({ where: { id: inviteId }, data: { revokedAt: now } });
  }
  return { declined: true };
}

// ───────────────────────────── join requests ─────────────────────────────

/** AC4: one PENDING request per (team, user); 403 if the team is closed; 409 if member, pending, or full. */
export async function requestToJoin(userId: string, input: CreateJoinRequestInput): Promise<JoinRequestDTO> {
  const team = await db.team.findUnique({ where: { id: input.teamId }, select: { id: true, name: true, isOpen: true } });
  if (!team) throw errors.notFound("That team");
  if (!team.isOpen) throw errors.forbidden("This team isn't accepting join requests. Ask a member for an invite link.");

  const request = await db.$transaction(async (tx) => {
    await lockTeam(tx, team.id);
    if (await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: team.id, userId } } })) {
      throw errors.conflict(`You're already a member of ${team.name}.`);
    }
    if (await tx.joinRequest.findFirst({ where: { teamId: team.id, userId, status: "PENDING" } })) {
      throw errors.conflict(`You already asked to join ${team.name}. A leader will respond soon.`);
    }
    await assertRoom(tx, team.id);
    const r = await tx.joinRequest.create({
      data: { teamId: team.id, userId, message: input.message || null },
      include: joinRequestInclude,
    });
    await logActivity(
      { teamId: team.id, actorId: userId, type: "JOIN_REQUESTED", entityType: "member", entityId: userId, summary: "asked to join the team" },
      tx,
    );
    await notify(
      {
        userIds: await leaderIds(tx, team.id),
        type: "JOIN_REQUEST",
        teamId: team.id,
        title: `${r.user.name} asked to join “${team.name}”`,
        body: r.message,
        link: `/teams/${team.id}/members`,
      },
      tx,
    );
    return r;
  });
  return toJoinRequestDTO(request);
}

/** Leader only: PENDING requests, oldest first. */
export async function listJoinRequests(teamId: string, actorId: string): Promise<JoinRequestDTO[]> {
  await requireLeader(teamId, actorId);
  const rows = await db.joinRequest.findMany({
    where: { teamId, status: "PENDING" },
    include: joinRequestInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toJoinRequestDTO);
}

/** My requests, newest first (pending ones plus recent decisions so I can see the outcome). */
export async function listMyJoinRequests(userId: string): Promise<JoinRequestDTO[]> {
  const rows = await db.joinRequest.findMany({
    where: { userId },
    include: joinRequestInclude,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map(toJoinRequestDTO);
}

/** Requester only (others get 404 so request ids don't leak); only PENDING requests can be cancelled. */
export async function cancelJoinRequest(requestId: string, userId: string): Promise<{ cancelled: true }> {
  const request = await db.joinRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== userId) throw errors.notFound("That join request");
  if (request.status !== "PENDING") throw errors.conflict("That request was already answered, so it can't be cancelled.");
  await db.joinRequest.update({ where: { id: requestId }, data: { status: "CANCELLED", decidedAt: new Date() } });
  return { cancelled: true };
}

/** AC5: only a leader of that team may decide (403 otherwise); APPROVE adds the member (409 if full, AC7). */
export async function decideJoinRequest(
  requestId: string,
  actorId: string,
  input: DecideJoinRequestInput,
): Promise<JoinRequestDTO> {
  const existing = await db.joinRequest.findUnique({ where: { id: requestId }, select: { teamId: true } });
  if (!existing) throw errors.notFound("That join request");
  await requireLeader(existing.teamId, actorId);
  const now = new Date();

  const decided = await db.$transaction(async (tx) => {
    await lockTeam(tx, existing.teamId);
    const request = await tx.joinRequest.findUniqueOrThrow({ where: { id: requestId }, include: joinRequestInclude });
    if (request.status !== "PENDING") throw errors.conflict("Someone already answered this request.");
    const { team, user } = request;
    const approve = input.decision === "APPROVE";

    if (approve) {
      const isMemberAlready = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
      });
      if (!isMemberAlready) await assertRoom(tx, team.id);
    }
    const updated = await tx.joinRequest.update({
      where: { id: requestId },
      data: { status: approve ? "APPROVED" : "DECLINED", decidedAt: now, decidedById: actorId },
      include: joinRequestInclude,
    });
    await logActivity(
      {
        teamId: team.id,
        actorId,
        type: approve ? "JOIN_APPROVED" : "JOIN_DECLINED",
        entityType: "member",
        entityId: user.id,
        summary: approve ? `approved ${user.name}'s request to join` : `declined ${user.name}'s request to join`,
      },
      tx,
    );
    if (approve) await addMember(tx, team.id, user.id, now);
    await notify(
      {
        userIds: [user.id],
        type: "JOIN_DECISION",
        teamId: team.id,
        title: approve ? `You're in! You joined “${team.name}”` : `“${team.name}” declined your request to join`,
        link: approve ? `/teams/${team.id}` : `/teams?course=${encodeURIComponent(team.courseCode)}`,
      },
      tx,
    );
    return updated;
  });
  return toJoinRequestDTO(decided);
}

// ───────────────────────────── members and roles ─────────────────────────────

async function memberOrNotFound(client: DbOrTx, teamId: string, userId: string): Promise<MemberRow> {
  const m = await client.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, include: memberInclude });
  if (!m) throw errors.notFound("That member");
  return m;
}

/** Leader only. AC8: the last leader can't be demoted (409). Setting the same role again is a no-op. */
export async function changeRole(
  teamId: string,
  actorId: string,
  userId: string,
  input: ChangeRoleInput,
): Promise<TeamMemberDTO> {
  await requireLeader(teamId, actorId);
  const member = await db.$transaction(async (tx) => {
    await lockTeam(tx, teamId);
    const target = await memberOrNotFound(tx, teamId, userId);
    if (target.role === input.role) return target;
    if (input.role === "MEMBER" && wouldRemoveLastLeader(target.role, (await leaderIds(tx, teamId)).length)) {
      throw errors.conflict(
        `${target.userId === actorId ? "You're" : `${target.user.name} is`} the only leader. Make someone else a leader first.`,
      );
    }
    const updated = await tx.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role: input.role },
      include: memberInclude,
    });
    await logActivity(
      {
        teamId,
        actorId,
        type: "MEMBER_ROLE_CHANGED",
        entityType: "member",
        entityId: userId,
        summary: `made ${updated.user.name} ${input.role === "LEADER" ? "a leader" : "a member"}`,
        metadata: { from: target.role, to: input.role },
      },
      tx,
    );
    return updated;
  });
  return toMemberDTO(member);
}

/**
 * Leave (actor removes themselves → MEMBER_LEFT) or remove someone (leaders only → MEMBER_REMOVED).
 * AC8: the last leader can't leave (409). Task assignments stay on the board (PB-05 owns `task_assignee`).
 */
export async function removeMember(teamId: string, actorId: string, userId: string): Promise<{ removed: true }> {
  const actor = await requireMembership(teamId, actorId);
  const leaving = actorId === userId;
  if (!leaving && actor.role !== "LEADER") throw errors.forbidden("Only a team leader can remove members.");

  await db.$transaction(async (tx) => {
    await lockTeam(tx, teamId);
    const target = await memberOrNotFound(tx, teamId, userId);
    if (wouldRemoveLastLeader(target.role, (await leaderIds(tx, teamId)).length)) {
      throw errors.conflict("You're the only leader. Make someone else a leader before you leave.");
    }
    await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    await logActivity(
      leaving
        ? { teamId, actorId, type: "MEMBER_LEFT", entityType: "member", entityId: userId, summary: "left the team" }
        : {
            teamId,
            actorId,
            type: "MEMBER_REMOVED",
            entityType: "member",
            entityId: userId,
            summary: `removed ${target.user.name} from the team`,
          },
      tx,
    );
  });
  return { removed: true };
}

// ───────────────────────────── page helpers ─────────────────────────────

/** Courses on my profile, for the /teams search default. */
export async function myCourses(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { courses: true } });
  return user?.courses ?? [];
}

/** Role lookup for pages (null if not a member). */
export async function myRoleIn(teamId: string, userId: string): Promise<TeamRoleValue | null> {
  const m = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true } });
  return m?.role ?? null;
}
