/**
 * PB-17 · NFR-01 — adds load-test data for `perf/load.js`: 50 teams / 2,000 tasks, plus a few meetings and activity
 * rows per team so the board, calendar, and activity pages have realistic sizes.
 *
 * SAFE FOR STAGING (it's also the demo site):
 * - Only ADDS rows. It never deletes anything, and never imports `prisma/seed.ts` (which wipes all data). The one update
 *   is `--reset-password`, which touches only the load accounts' own password hash.
 * - Everything it creates is recognizable: users `load-NN@studycrew.test`, teams in course `LOAD 9000` named `Load Team NN`.
 * - Idempotent: if `Load Team 01` already exists it stops, so running it twice doesn't double the data.
 *
 * Usage: set DATABASE_URL (on staging, the Neon DIRECT url) and LOAD_TEST_PASSWORD in your own shell from a hidden
 * prompt, never on the command line (perf/README.md has the exact commands), then:
 *   npx tsx perf/seed-load.ts --dry-run    # prints the plan, the target host, and what's in it; writes nothing
 *   npx tsx perf/seed-load.ts              # create
 *   npx tsx perf/seed-load.ts --reset-password   # only re-sets the 10 load accounts' password (e.g. after a typo)
 * The password is for the load accounts only. Keep it out of git; the nfr.yml workflow reads it from a repo secret.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";

export const LOAD_COURSE = "LOAD 9000";
export const TEAMS = 50;
export const TASKS_PER_TEAM = 40; // 50 × 40 = 2,000 tasks
export const USERS = 10; // k6 signs in once per user (Better Auth allows ~3 sign-ins / 10 s / IP), VUs share sessions
export const TEAMS_PER_USER = 5; // each load user is in 5 teams → every team has a member to act as
const MEETINGS_PER_TEAM = 6;

const pad = (n: number) => String(n).padStart(2, "0");
export const loadEmail = (i: number) => `load-${pad(i)}@studycrew.test`;
export const loadTeamName = (i: number) => `Load Team ${pad(i)}`;

/** Which load users belong to team `t` (0-based): user t % USERS leads, the next one is a member. */
export function membersOfTeam(t: number): { leader: number; member: number } {
  return { leader: t % USERS, member: (t + 1) % USERS };
}

const STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL to the target database (on staging: the Neon direct URL).");
  console.log(
    `Plan: ${USERS} users (${loadEmail(1)}…${loadEmail(USERS)}), ${TEAMS} teams in "${LOAD_COURSE}", ` +
      `${TEAMS * TASKS_PER_TEAM} tasks, ${TEAMS * MEETINGS_PER_TEAM} meetings. Adds only; deletes nothing.`,
  );
  // Host and database name only (no user or password), so whoever runs it can see which database it will write to.
  const target = new URL(url);
  console.log(`Target database: ${target.hostname}${target.pathname}`);
  const password = process.env.LOAD_TEST_PASSWORD ?? "";
  if (!dryRun && password.length < 12) {
    throw new Error("Set LOAD_TEST_PASSWORD (12+ characters) for the load accounts.");
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    // Read-only summary, so whoever runs it can tell the live staging DB (recent activity) from an empty or local one.
    const [userCount, teamCount, loadUsers, latest] = await Promise.all([
      db.user.count(),
      db.team.count(),
      db.user.count({ where: { email: { startsWith: "load-", endsWith: "@studycrew.test" } } }),
      db.activityEvent.findFirst({
        where: { team: { courseCode: { not: LOAD_COURSE } } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    console.log(
      `It has ${userCount} users (${loadUsers} of them load users) and ${teamCount} teams; ` +
        `latest non-load activity: ${latest ? latest.createdAt.toISOString() : "none"}.`,
    );
    if (dryRun) return;
    if (process.argv.includes("--reset-password")) {
      // Only the load accounts' password hash changes; their teams and every other row stay as they are.
      const emails = Array.from({ length: USERS }, (_, i) => loadEmail(i + 1));
      const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const { count } = await db.account.updateMany({
        where: { userId: { in: users.map((u) => u.id) }, providerId: "credential" },
        data: { password: await hashPassword(password) },
      });
      console.log(`Found ${users.length} of ${USERS} load users; set a new password on ${count} of their accounts.`);
      return;
    }
    if (await db.team.findFirst({ where: { courseCode: LOAD_COURSE, name: loadTeamName(1) }, select: { id: true } })) {
      console.log(`"${loadTeamName(1)}" already exists: load data is already seeded. Nothing to do.`);
      return;
    }
    const hash = await hashPassword(password);
    const users: string[] = [];
    for (let i = 1; i <= USERS; i++) {
      const email = loadEmail(i);
      const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        users.push(existing.id);
        continue;
      }
      const u = await db.user.create({
        data: { name: `Load User ${pad(i)}`, email, emailVerified: true, timezone: "America/Chicago", courses: [LOAD_COURSE] },
        select: { id: true },
      });
      await db.account.create({ data: { userId: u.id, accountId: u.id, providerId: "credential", password: hash } });
      users.push(u.id);
    }

    const now = Date.now();
    const DAY = 86_400_000;
    for (let t = 0; t < TEAMS; t++) {
      const { leader, member } = membersOfTeam(t);
      const team = await db.team.create({
        data: {
          name: loadTeamName(t + 1),
          courseCode: LOAD_COURSE,
          description: "Load-test data (perf/seed-load.ts). Safe to ignore.",
          isOpen: false,
          inviteCode: `load-team-${pad(t + 1)}-${now.toString(36)}`,
          createdById: users[leader],
          members: { create: [{ userId: users[leader], role: "LEADER" }, { userId: users[member], role: "MEMBER" }] },
        },
        select: { id: true },
      });
      await db.task.createMany({
        data: Array.from({ length: TASKS_PER_TEAM }, (_, k) => {
          const status = STATUSES[k % STATUSES.length];
          return {
            teamId: team.id,
            title: `Load task ${pad(t + 1)}-${String(k + 1).padStart(3, "0")}`,
            status,
            priority: PRIORITIES[k % PRIORITIES.length],
            dueAt: new Date(now + ((k % 21) - 7) * DAY),
            position: (Math.floor(k / STATUSES.length) + 1) * 1000,
            createdById: users[k % 2 ? member : leader],
            completedAt: status === "DONE" ? new Date(now - DAY) : null,
          };
        }),
      });
      await db.meeting.createMany({
        data: Array.from({ length: MEETINGS_PER_TEAM }, (_, k) => {
          const startsAt = new Date(now + (k - 2) * 2 * DAY);
          return {
            teamId: team.id,
            title: `Load meeting ${k + 1}`,
            startsAt,
            endsAt: new Date(startsAt.getTime() + 3_600_000),
            createdById: users[leader],
          };
        }),
      });
      await db.activityEvent.createMany({
        data: Array.from({ length: 20 }, (_, k) => ({
          teamId: team.id,
          actorId: users[k % 2 ? member : leader],
          type: "TASK_CREATED",
          entityType: "task",
          summary: `created “Load task ${pad(t + 1)}-${String(k + 1).padStart(3, "0")}”`,
          createdAt: new Date(now - k * 3_600_000),
        })),
      });
    }
    console.log(`Done: ${USERS} users, ${TEAMS} teams, ${TEAMS * TASKS_PER_TEAM} tasks, ${TEAMS * MEETINGS_PER_TEAM} meetings.`);
  } finally {
    await db.$disconnect();
  }
}

// Run only when executed directly (tests import the helpers above).
if (process.argv[1] && /seed-load\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
