# AI log — Foundation / shared contracts (part of PB-01)

| Date | Phase | Tool | Prompt / input (summary) | Output used | Human validation / correction |
|---|---|---|---|---|---|
| 2026-10-22 | Requirements / planning | Claude Code (Opus) | Read the approved proposal, progress-report template, and lecture slides; summarize grading criteria | Rubric-to-lecture mapping used to shape docs (UI rules, ADRs, risk update) | Varad checked against the template's grading table |
| 2026-10-22 | Design | Claude Code | "Create shared contracts so 4 people's agents can build their items independently and only meet in PRs" | Prisma schema for all 17 items, Zod contracts + DTOs, API catalogue, ownership map, ADRs, task specs PB-01…PB-17 | Varad to review every spec against proposal FRs/NFRs and owners (A.3); schema validated by `prisma validate` + migration applied to Postgres |
| 2026-10-22 | Implementation | Claude Code | Scaffold Next.js 16 app with Better Auth, Prisma 7, service-layer helpers, UI kit, app shell, placeholder pages | All foundation code | Agent read Next 16 bundled docs and disabled Cache Components (decision recorded as ADR 6); fixed nav highlight bug found while clicking through in the browser |
| 2026-10-22 | Testing / QA | Claude Code | Vitest unit + integration harness, factories, session mock, auto-discovering authorization sweep, Cypress smoke + axe | 21 passing tests, 74% line coverage, smoke spec | Fixed a vi.mock hoisting bug and an over-strict mock-model assertion caught on first run; Cypress smoke runs in CI (not run locally) |

**To review before merge (Dev, Varad):** read `src/server/http.ts`, `permissions.ts`, `auth.ts`, and the schema; confirm
the seed password and env handling are dev-only; confirm task ownership matches the proposal.
