# StudyCrew

**Collaborative study and team planning hub** — CSE 6324 Advanced Topics in Software Engineering, Fall 2026 (Topic 6).

Student teams form groups, paint their availability and get ranked meeting times, run a task board, share notes and
links, get in-app notifications, watch a progress dashboard, and use the **AI Coverage Check** to compare assignment
instructions with their draft and find what's missing before they submit.

| Team | GitHub | Role |
|---|---|---|
| Varad Tambe (M1) | @tambevarad | Product Owner, full-stack |
| Krish Ruparel (M2) | @Krishr21 | Scrum Master, QA lead |
| Dev Patel (M3) | @devjpatell | Tech lead, backend/DevOps |
| Devarsh Soni (M4) | @Mercapt-0 | AI lead, frontend |

## Stack

TypeScript · Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Better Auth · Prisma 7 + PostgreSQL 16 · Zod 4 ·
FullCalendar · dnd-kit · Recharts · TanStack Query · Vercel AI SDK (OpenAI default; Gemini/Claude swappable; mock in tests) ·
Vitest · Cypress + cypress-axe · GitHub Actions · Vercel + Neon.

## Quick start

```bash
npm ci
cp .env.example .env && cp .env.example .env.local   # set BETTER_AUTH_SECRET: openssl rand -base64 32
npm run db:up            # Postgres 16 in Docker
npm run db:migrate && npm run db:test:migrate && npm run db:seed
npm run dev              # http://localhost:3000
```

Seed accounts (`varad@studycrew.test`, `krish@…`, `dev@…`, `devarsh@…`, `outsider@…`, `maya@…`) share one dev-only
password defined at the top of `prisma/seed.ts`.

```bash
npm run check            # lint + typecheck + unit + integration
npm run test:coverage    # coverage gate (≥ 70% lines)
npm run build && npm run start   # then: npm run test:e2e
```

## Where things are

| Need | Read |
|---|---|
| How to work in this repo (humans and agents) | [`CLAUDE.md`](CLAUDE.md) |
| Your backlog item | [`docs/tasks/`](docs/tasks/README.md) |
| Architecture, API, data model, UI rules, testing | [`docs/contracts/`](docs/contracts/) |
| Who owns which files; review pairs | [`docs/process/ownership.md`](docs/process/ownership.md) |
| Branches, PRs, contract changes, AI log, Scrum events | [`docs/process/workflow.md`](docs/process/workflow.md) |
| Re-baselined schedule | [`docs/process/sprint-plan.md`](docs/process/sprint-plan.md) |
| Starting your coding agent | [`docs/process/agent-kickoff.md`](docs/process/agent-kickoff.md) |

## Requirements traceability

Functional requirements FR-01…FR-10 and nonfunctional requirements NFR-01…NFR-06 come from the approved proposal. Each
backlog item's spec lists the FRs it covers and the tests that prove its acceptance criteria; PB-17 assembles the
traceability matrix in `docs/test-report.md`.
