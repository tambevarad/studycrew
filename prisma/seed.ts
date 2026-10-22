/**
 * Development + E2E seed. Idempotent: wipes app data, then recreates it.
 * Every user's password is SEED_PASSWORD below (test value only — never a real password).
 *
 *   npm run db:seed
 *
 * Seed accounts (all in "StudyCrew Core" for CSE 6324 unless noted):
 *   varad@studycrew.test   leader
 *   krish@studycrew.test   member
 *   dev@studycrew.test     member
 *   devarsh@studycrew.test member
 *   outsider@studycrew.test  not on any team (use for join-request and 403 tests)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

export const SEED_PASSWORD = "studycrew-dev-pass";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const people = [
  { key: "varad", name: "Varad Tambe", tz: "America/Chicago", courses: ["CSE 6324", "CSE 5311"], skills: ["Next.js", "Product"] },
  { key: "krish", name: "Krish Ruparel", tz: "America/Chicago", courses: ["CSE 6324"], skills: ["Testing", "Cypress"] },
  { key: "dev", name: "Dev Patel", tz: "America/New_York", courses: ["CSE 6324", "CSE 5360"], skills: ["Postgres", "DevOps"] },
  { key: "devarsh", name: "Devarsh Soni", tz: "America/Los_Angeles", courses: ["CSE 6324"], skills: ["UI", "LLMs"] },
  { key: "outsider", name: "Olivia Outsider", tz: "America/Chicago", courses: ["CSE 6324"], skills: ["Writing"] },
  { key: "maya", name: "Maya Chen", tz: "America/Chicago", courses: ["CSE 6324"], skills: ["Research"] },
] as const;

/** Mon–Fri evenings 18:00–22:00 plus Saturday 10:00–14:00, with per-person tweaks. */
function slotsFor(i: number): number[] {
  const slots: number[] = [];
  for (let day = 0; day < 5; day++) for (let h = 36 + (i % 2); h < 44; h++) slots.push(day * 48 + h);
  for (let h = 20 + i; h < 28; h++) slots.push(5 * 48 + h);
  return slots;
}

const daysFromNow = (d: number, hour = 12) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(hour, 0, 0, 0);
  return t;
};

async function main() {
  // Wipe app data (order matters only for non-cascading FKs).
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE "user", "team", "notification", "activity_event", "verification" RESTART IDENTITY CASCADE;
  `);

  const hash = await hashPassword(SEED_PASSWORD);
  const users: Record<string, { id: string; name: string }> = {};
  for (const [i, p] of people.entries()) {
    const u = await db.user.create({
      data: {
        name: p.name,
        email: `${p.key}@studycrew.test`,
        emailVerified: true,
        timezone: p.tz,
        courses: [...p.courses],
        skills: [...p.skills],
        availability: { create: { slots: slotsFor(i) } },
      },
    });
    await db.account.create({ data: { userId: u.id, accountId: u.id, providerId: "credential", password: hash } });
    users[p.key] = u;
  }

  const core = await db.team.create({
    data: {
      name: "StudyCrew Core",
      courseCode: "CSE 6324",
      description: "Advanced Topics in SE — semester project team.",
      inviteCode: "core-cse6324-demo",
      createdById: users.varad.id,
      members: {
        create: [
          { userId: users.varad.id, role: "LEADER" },
          { userId: users.krish.id },
          { userId: users.dev.id },
          { userId: users.devarsh.id },
        ],
      },
    },
  });

  const other = await db.team.create({
    data: {
      name: "Query Optimizers",
      courseCode: "CSE 6324",
      description: "Looking for one more member who likes databases.",
      inviteCode: "query-opt-demo",
      createdById: users.maya.id,
      members: { create: [{ userId: users.maya.id, role: "LEADER" }] },
    },
  });

  await db.team.create({
    data: {
      name: "Closed Study Group",
      courseCode: "CSE 5311",
      isOpen: false,
      inviteCode: "closed-demo",
      createdById: users.maya.id,
      members: { create: [{ userId: users.maya.id, role: "LEADER" }] },
    },
  });

  const milestone = await db.milestone.create({
    data: { teamId: core.id, title: "Progress report", dueAt: daysFromNow(2, 23), templateKey: "report", position: 0 },
  });

  const tasks = [
    { title: "Draft architecture section", status: "DONE", priority: "HIGH", due: -3, who: ["varad"] },
    { title: "Set up CI pipeline", status: "DONE", priority: "HIGH", due: -2, who: ["dev"] },
    { title: "Write Cypress smoke test", status: "REVIEW", priority: "MEDIUM", due: 1, who: ["krish"] },
    { title: "Design task board UI", status: "IN_PROGRESS", priority: "MEDIUM", due: 2, who: ["devarsh"] },
    { title: "Collect AI evaluation cases", status: "TODO", priority: "HIGH", due: 5, who: ["devarsh", "dev"] },
    { title: "Book room for rehearsal", status: "TODO", priority: "LOW", due: -1, who: ["krish"] },
    { title: "Proofread proposal feedback", status: "TODO", priority: "LOW", due: null, who: [] },
  ] as const;
  const positions: Record<string, number> = {};
  for (const t of tasks) {
    positions[t.status] = (positions[t.status] ?? 0) + 1000;
    await db.task.create({
      data: {
        teamId: core.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueAt: t.due === null ? null : daysFromNow(t.due, 22),
        position: positions[t.status],
        completedAt: t.status === "DONE" ? daysFromNow(-1) : null,
        milestoneId: t.title.includes("architecture") || t.title.includes("Cypress") ? milestone.id : null,
        createdById: users.varad.id,
        assignees: { create: t.who.map((k) => ({ userId: users[k].id })) },
      },
    });
  }

  await db.meeting.create({
    data: {
      teamId: core.id,
      title: "Sprint review and retro",
      location: "ERB 331",
      startsAt: daysFromNow(2, 19),
      endsAt: daysFromNow(2, 20),
      createdById: users.varad.id,
      rsvps: { create: [{ userId: users.varad.id, response: "YES" }, { userId: users.krish.id, response: "MAYBE" }] },
    },
  });

  await db.resource.createMany({
    data: [
      { teamId: core.id, type: "LINK", title: "Course syllabus", url: "https://example.edu/cse6324/syllabus", createdById: users.varad.id, pinned: true },
      { teamId: core.id, type: "FILE_REF", title: "Proposal (Google Drive)", url: "https://drive.google.com/file/d/example", createdById: users.krish.id },
      { teamId: core.id, type: "NOTE", title: "Retro notes — Sprint 2", body: "Start: pair on calendar. Stop: late PRs. Continue: daily stand-up in chat.", createdById: users.dev.id },
    ],
  });

  await db.activityEvent.createMany({
    data: [
      { teamId: core.id, actorId: users.varad.id, type: "TEAM_CREATED", entityType: "team", entityId: core.id, summary: "created the team", createdAt: daysFromNow(-5) },
      { teamId: core.id, actorId: users.krish.id, type: "MEMBER_JOINED", entityType: "member", entityId: users.krish.id, summary: "joined the team", createdAt: daysFromNow(-5) },
      { teamId: core.id, actorId: users.dev.id, type: "TASK_COMPLETED", entityType: "task", summary: "completed “Set up CI pipeline”", createdAt: daysFromNow(-1) },
    ],
  });

  await db.joinRequest.create({ data: { teamId: other.id, userId: users.outsider.id, message: "I can help with SQL!" } });

  await db.notification.create({
    data: {
      userId: users.krish.id,
      teamId: core.id,
      type: "TASK_ASSIGNED",
      title: "Varad assigned you “Write Cypress smoke test”",
      link: `/teams/${core.id}/board`,
    },
  });

  console.log(`Seeded ${people.length} users, 3 teams. Password for all seed users: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
