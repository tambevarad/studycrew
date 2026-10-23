/**
 * Test data builders. Every integration test builds exactly the data it needs.
 *   const { leader, members, team } = await makeTeam({ members: 2 });
 */
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";

let seq = 0;
const next = () => ++seq;

export async function makeUser(overrides: Partial<{ name: string; email: string; timezone: string; courses: string[] }> = {}) {
  const n = next();
  return db.user.create({
    data: {
      name: overrides.name ?? `User ${n}`,
      email: overrides.email ?? `user${n}-${Date.now()}@test.local`,
      timezone: overrides.timezone ?? "America/Chicago",
      courses: overrides.courses ?? ["CSE 6324"],
    },
  });
}

export async function makeTeam(opts: { members?: number; courseCode?: string; isOpen?: boolean; name?: string } = {}) {
  const leader = await makeUser();
  const members = [];
  for (let i = 0; i < (opts.members ?? 0); i++) members.push(await makeUser());
  const team = await db.team.create({
    data: {
      name: opts.name ?? `Team ${next()}`,
      courseCode: opts.courseCode ?? "CSE 6324",
      isOpen: opts.isOpen ?? true,
      inviteCode: `invite-${next()}-${Date.now()}`,
      createdById: leader.id,
      members: {
        create: [{ userId: leader.id, role: "LEADER" }, ...members.map((m) => ({ userId: m.id, role: "MEMBER" as const }))],
      },
    },
  });
  return { team, leader, members };
}

export async function makeTask(
  teamId: string,
  createdById: string,
  overrides: Partial<{ title: string; status: TaskStatus; priority: TaskPriority; dueAt: Date | null; position: number; assigneeIds: string[] }> = {},
) {
  return db.task.create({
    data: {
      teamId,
      createdById,
      title: overrides.title ?? `Task ${next()}`,
      status: overrides.status ?? "TODO",
      priority: overrides.priority ?? "MEDIUM",
      dueAt: overrides.dueAt ?? null,
      position: overrides.position ?? next() * 1000,
      assignees: { create: (overrides.assigneeIds ?? []).map((userId) => ({ userId })) },
    },
  });
}

export async function makeMeeting(teamId: string, createdById: string, startsAt: Date, minutes = 60) {
  return db.meeting.create({
    data: { teamId, createdById, title: `Meeting ${next()}`, startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) },
  });
}
