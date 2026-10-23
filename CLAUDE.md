# StudyCrew — instructions for coding agents

You are working on **StudyCrew**, a CSE 6324 team project: a web app where student teams form groups, find meeting times,
track tasks, share resources, get notifications, see progress, and run an **AI Coverage Check** that compares assignment
instructions with their draft. Four people (each with their own agent) build it in parallel, one backlog item per branch.

**Your human tells you which backlog item(s) you own (e.g. "I'm Krish, do PB-02").** Everything you need is in this repo.
Do not ask other team members' agents for anything — the contracts below make your item independent.

## Read in this order (before writing code)

1. This file.
2. `docs/tasks/PB-XX.md` for your item — scope, files you own, routes, acceptance criteria, required tests.
3. `docs/contracts/00-architecture.md` — layers, patterns, and the rules that keep four branches from colliding.
4. The contract files your task names in `src/contracts/` (Zod inputs + DTO outputs) and `prisma/schema.prisma`.
5. `docs/contracts/ui-guidelines.md` if your item has UI (graded: usability, accessibility, consistency).
6. `docs/contracts/testing.md` and `docs/process/workflow.md` before you open the PR.

Next.js 16 has breaking changes from what you may remember. See `AGENTS.md` and read the relevant guide under
`node_modules/next/dist/docs/` before using an unfamiliar Next API. Middleware is now `proxy.ts` (we don't use one).
`params` and `searchParams` are Promises. `LayoutProps<"/route">` / `PageProps<"/route">` are global types.

## Hard rules (a PR that breaks these is rejected)

1. **Only edit files your task file lists under "Files you own"** plus new files inside your owned folders and your
   own tests. Everything else is shared and frozen: `prisma/schema.prisma`, `prisma/migrations/**`, `src/contracts/**`,
   `src/server/{db,auth,session,http,errors,permissions,activity,notifications,mappers}.ts`, `src/server/shared/**`,
   `src/components/ui/**`, `src/components/app-shell/**`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`,
   `src/app/(app)/teams/[teamId]/layout.tsx`, `package.json`, `package-lock.json`, CI config, and other people's folders.
2. **Need a shared file changed?** Don't change it. Write the request into `docs/contract-requests/PB-XX-<slug>.md`
   (template in `docs/process/workflow.md`), tell your human, and work around it if possible. Tech lead merges contract
   changes in a separate PR.
3. **No new npm dependencies.** Everything planned is installed (FullCalendar, dnd-kit, Recharts, TanStack Query, Vercel AI
   SDK + OpenAI/Google/Anthropic providers, date-fns + @date-fns/tz, lucide-react, sonner, zod). Ask via a contract request
   if you truly need another.
4. **No schema changes, no migrations.** The schema already has every table for PB-01…PB-17.
5. **Layering:** UI (pages/components) → route handler or Server Component → **service** (`src/server/services/<feature>/`)
   → Prisma. Only `src/server/**` imports `db` (ESLint enforces this). All business rules and permission checks live in
   services or `teamRoute()`. Services return **DTOs from `src/contracts`** with ISO-string dates.
6. **Every team-scoped API route lives under `src/app/api/v1/teams/[teamId]/…` and uses `teamRoute()`**, which checks
   membership before your code runs. The authorization sweep test auto-discovers these routes and fails your PR if a
   non-member gets anything but 403. For a nested entity (`…/tasks/[taskId]`) the service must also check the entity
   belongs to `teamId` and throw `errors.notFound()` otherwise.
7. **Write side effects through the shared helpers:** `logActivity()` for history (FR-06) and `notify()` for in-app
   notifications (FR-05), inside the same transaction as the change. Your task file lists which types you must emit.
8. **Services may READ any table but WRITE only the tables their item owns** (see `docs/process/ownership.md`). To change
   another feature's data, call that feature's exported service function.
9. **Tests are part of the item:** unit tests for pure logic, integration tests for every service function and route
   (real Postgres), and one Cypress spec for your main flow with `cy.checkPageA11y()`. Coverage must stay ≥ 70%.
10. **Never** commit secrets or `.env*` files, never call a real AI provider from tests, never disable lint/type rules to
   make CI pass, never force-push `main`.

## Commands

```bash
npm ci                         # install (runs prisma generate)
cp .env.example .env && cp .env.example .env.local   # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:up                  # Postgres 16 in Docker (creates studycrew + studycrew_test)
npm run db:migrate             # apply migrations to the dev DB
npm run db:test:migrate        # apply migrations to the test DB
npm run db:seed                # demo data; accounts + password are documented at the top of prisma/seed.ts
npm run dev                    # http://localhost:3000  (sign in as varad@studycrew.test etc.)

npm run lint && npm run typecheck
npm run test:unit              # fast, no DB
npm run test:integration       # needs the test DB
npm run test:coverage          # what CI runs (fails under 70% lines)
npm run build && npm run start # then in another shell:
npm run test:e2e               # Cypress against localhost:3000 (needs seeded dev DB)
npm run check                  # lint + typecheck + all vitest — run before every push
```

## Patterns to copy

**Read on a page (Server Component calls the service directly):**

```tsx
// src/app/(app)/teams/[teamId]/board/page.tsx
export default async function BoardPage({ params }: PageProps<"/teams/[teamId]/board">) {
  const { teamId } = await params;
  const user = await requirePageUser();          // layout already blocked non-members
  const tasks = await listTasks(teamId, user.id, {});
  return <TaskBoard teamId={teamId} initialTasks={tasks} me={user} />;
}
```

**Write from the UI (client component → REST route → service), then refresh:**

```tsx
"use client";
const { run, pending, fieldErrors } = useApiAction();
await run(() => apiFetch<TaskDTO>(`/api/v1/teams/${teamId}/tasks`, { method: "POST", body: input }), { success: "Task added" });
```

**Route handler:**

```ts
// src/app/api/v1/teams/[teamId]/tasks/route.ts
export const GET = teamRoute(async ({ req, params, user }) => listTasks(params.teamId, user.id, parseQuery(req, listTasksQuery)));
export const POST = teamRoute(async ({ req, params, user }) =>
  created(await createTask(params.teamId, user.id, await parseBody(req, createTaskInput))));
```

**Service with side effects:**

```ts
export async function createTask(teamId: string, actorId: string, input: CreateTaskInput): Promise<TaskDTO> {
  await requireMembership(teamId, actorId);
  await assertAllMembers(teamId, input.assigneeIds);
  const task = await db.$transaction(async (tx) => {
    const t = await tx.task.create({ data: { /* … */ }, include: taskInclude });
    await logActivity({ teamId, actorId, type: "TASK_CREATED", entityType: "task", entityId: t.id, summary: `created “${t.title}”` }, tx);
    await notify({ userIds: input.assigneeIds, exceptUserId: actorId, type: "TASK_ASSIGNED", teamId,
                   title: `You were assigned “${t.title}”`, link: `/teams/${teamId}/board?task=${t.id}` }, tx);
    return t;
  });
  return toTaskDTO(task);
}
```

Throw `errors.forbidden() / notFound() / validation() / conflict() / rateLimited() / upstream()` from
`src/server/errors.ts`; messages are shown to users, so make them specific and helpful.

## Definition of Done (from the proposal — the TA checks this)

- [ ] Every acceptance criterion in your task file passes as an automated test (name tests after the criterion).
- [ ] `npm run check` passes locally; `npm run build` passes; your Cypress spec passes.
- [ ] Service code coverage stays ≥ 70%; no serious/critical axe violations on pages you changed.
- [ ] UI follows `docs/contracts/ui-guidelines.md` (states: loading, empty, error, success; keyboard access).
- [ ] Docs updated: your task file's "Implementation notes" section and the API table if you added an optional endpoint.
- [ ] AI-usage log written at `docs/ai-log/PB-XX.md` (what the agent did, what the human checked/changed) — this is graded.
- [ ] PR opened with the template filled in, linked to the issue (`Closes #N`), reviewed and approved by a teammate who
      can explain the code, CI green, then squash-merged to `main`.

## When you finish

Push your branch, open the PR with `gh pr create --fill --base main` and complete the template (screenshots of the
working UI are required for the progress report). Then tell your human exactly what to review and how to demo it.
