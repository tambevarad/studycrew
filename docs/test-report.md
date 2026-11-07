# Test report (PB-17)

> **Status: draft, 2026-11-03, `main` @ `6e7eb07`.** The FR traceability for merged items (§3, §4) and the CI and
> coverage evidence (§2) are filled in. NFR results that come from later runs are marked **⏳ pending** with the
> owner who will fill them in (§5). Nothing marked pending has been run yet; nothing in this file is estimated.
>
> Owner: Krish Ruparel (test report, usability) · Dev Patel (NFR-01/02/03/05 scripts and runs)

**Legend:** ✅ passing, with evidence linked · ⚠️ met with an exception (explained) · ❌ failing · ⏳ pending (owner and
when).

## 0. Still to fill in

| # | What | Who | When / trigger |
|---|---|---|---|
| 1 | NFR-01 k6 load test result (`perf/load.js`, `perf/seed-load.ts`) | Dev | **Done** 2026-11-03 (§5) |
| 2 | NFR-02 OWASP ZAP baseline, `npm audit --omit=dev`, client-bundle secret scan | Dev | **Done** 2026-11-03 (§5); D-06 and D-07 open |
| 3 | NFR-03 Lighthouse CI on 6 pages (`lighthouserc.json`) and the 19-page axe sweep (`cypress/e2e/a11y-sweep.cy.ts`) | Dev | **Done** 2026-11-03 (§5) |
| 4 | NFR-04 usability sessions (≥ 5 students) and SUS: copy the §9.2 summary from `docs/process/usability-test.md` | Krish | after the sessions |
| 5 | NFR-05 uptime for the last 4 weeks (UptimeRobot on `/api/health`, from the public status page https://stats.uptimerobot.com/HoIv0SBQ5d) | Varad | end of Sprint 5 |
| 6 | FR rows for every merged item, PB-01 … PB-16 (§3, §4): **done** 2026-11-03 | Krish | — |
| 7 | Refresh §2 (test counts, coverage, CI history) on the **final** `main` commit | Krish | before the final report |
| 8 | File a GitHub issue for D-02 (root cause still unknown) and link it in §6 | Krish | now |

## 1. How to reproduce

```bash
npm ci && npm run db:up && npm run db:migrate && npm run db:test:migrate
npm run check                     # lint + typecheck + all Vitest suites
npm run test:coverage             # what CI runs; fails under 70% lines
npm run db:seed && npm run build && npm run start   # then, in another shell:
npm run test:e2e                  # all Cypress specs against localhost:3000
```

CI (`.github/workflows/ci.yml`) runs three jobs on every PR and every push to `main`:

- `quality`: lint, typecheck, and unit tests.
- `integration`: migrations, then `test:coverage` against Postgres 16.
- `e2e`: seed, build, start, then every Cypress spec in Chrome.

## 2. Automated suites on `main` @ `6e7eb07`

| Suite | Result | Evidence |
|---|---|---|
| Vitest unit + integration | **444 tests in 41 files, all passing** | CI `integration` job (`test:coverage`) in [run 41772661620](https://github.com/tambevarad/studycrew/actions/runs/41772661620), 2026-11-04 04:21 UTC (latest green run on `main`) |
| Coverage | **96.8 % lines** (1210/1250) · 96 % statements (1395/1453) · 89.01 % branches (802/901) · 97.09 % functions (368/379) | Same CI job; it uploads the `coverage` artifact |
| Cypress E2E | **71 tests in 16 specs, all passing** ("All specs passed!", 71/71; 20 of them are the 19-page axe sweep) | CI `e2e` job in [run 41772661620](https://github.com/tambevarad/studycrew/actions/runs/41772661620) |
| Authorization sweep (NFR-02) | Discovers routes automatically: all **45** `route.ts` files under `api/v1/` return 401 when signed out, and all **31** under `teams/[teamId]/` return 403 to a non-member, on every method | `tests/integration/authz-sweep.test.ts`, in the same run |
| CI history on `main` | **38 of 40** completed runs green; 1 red `e2e` run (see D-02); 1 cancelled (the #54 run, replaced by #55's push) | `gh run list --workflow ci.yml --branch main`, 2026-11-03 |

## 3. FR → test traceability

FR titles are paraphrased from the backlog specs (`docs/tasks/PB-*.md`, "Covers" column); the approved proposal's
wording is authoritative. An FR's priority is the highest priority of the items that cover it. "Passing" means it
passed in the CI run linked in §2.

| FR | Requirement (paraphrased) | Priority | Items (PR) | E2E specs (`cypress/e2e/`) | Integration (`tests/integration/`) | Unit (`tests/unit/`) | Status |
|---|---|---|---|---|---|---|---|
| FR-01 | Accounts, profiles, and weekly availability | Must | PB-02 (#23, #32), PB-03 (#26) | `auth.cy.ts` (5), `availability.cy.ts` (3) | `profile.test.ts`, `auth-timezone.test.ts`, `availability.test.ts` | `profile.test.ts`, `availability-grid.test.ts` | ✅ |
| FR-02 | Teams: create, invite links, course search, join requests | Must | PB-04 (#33) | `teams.cy.ts` (3) | `teams.test.ts` | `teams.test.ts` | ✅ (see D-01) |
| FR-03 | Team calendar and meeting-time finder | Must | PB-06 (#24, #41), PB-06b (#44) | `calendar.cy.ts` (4, incl. the PB-06b month view) | `meetings.test.ts` | `meeting-finder.test.ts`, `meeting-format.test.ts` | ✅ |
| FR-04 | Task board | Must | PB-05 (#25) | `board.cy.ts` (6) | `tasks.test.ts` | `tasks-board.test.ts`, `tasks-positions.test.ts` | ✅ |
| FR-05 | Shared resources and in-app notifications (incl. notifications other features emit) | Must | PB-07 (#22, #31), PB-08 (#27); emitted by PB-04/05/06/11/14 | `resources.cy.ts` (3), `notifications.cy.ts` (2) | `resources.test.ts`, `notifications.test.ts`; `notify()` asserted in `teams`, `tasks`, `meetings`, `coverage-actions` tests | `notifications.test.ts`, `resources-source.test.ts` | ✅ (poll notifications: `polls.test.ts` "logs POLL_CREATED and notifies the other members, not the creator", "AC3: closing early records the winner in activity and notifies members (not the closer)") |
| FR-06 | Activity history and team dashboard | Must | PB-09 (#21, #30), PB-12 (#45); activity emitted by every feature | `activity.cy.ts` (3), `dashboard.cy.ts` (3) | `activity.test.ts`, `dashboard.test.ts`; `logActivity()` asserted in `tasks`, `teams`, `meetings`, `resources`, `coverage`, `polls` tests | `activity-format.test.ts`, `dashboard.test.ts` | ✅ |
| FR-07 | AI Coverage Check: run, report, turn a gap into a task, rate it, evaluate | Must | PB-10 (#34), PB-11 (#42), PB-16 (#56) | `coverage.cy.ts` (3), `coverage-actions.cy.ts` (2) | `coverage.test.ts`, `coverage-actions.test.ts` | `coverage-quotes.test.ts`, `coverage-scoring.test.ts`, `coverage-providers.test.ts`, `mock-model.test.ts`, `coverage-actions.test.ts`, `ai-eval.test.ts` | ✅ check + actions · ✅ evaluation: [`docs/ai-eval-report.md`](ai-eval-report.md), all four targets met on prompt v1 in both runs (§4.2; run by hand with `npm run ai:eval`, never in CI) |
| FR-08 | Milestones and templates | Should | PB-13 (#43) | `milestones.cy.ts` (4) | `milestones.test.ts` | `milestones.test.ts` | ✅ |
| FR-09 | Group polls | Should | PB-14 (#50) | `polls.cy.ts` (1) | `polls.test.ts` | `polls.test.ts` | ✅ |
| FR-10 | Meeting agenda and help-needed topics | Could | PB-15 (#58) | `agenda.cy.ts` (2) | `agenda.test.ts` | `agenda.test.ts` | ✅ |
| (all) | Foundation: shell, auth guard, health, permissions, helpers | — | PB-01 (#18, #20, #39) | `smoke.cy.ts` (5) | `foundation.test.ts`, `health.test.ts`, `authz-sweep.test.ts` | `foundation.test.ts` | ✅ |

**PB-17 AC2** ("every Must FR links to at least one passing E2E spec"): **✅ complete.** Every Must FR, FR-01 … FR-07,
links to at least one passing E2E spec in the CI run in §2 (`6e7eb07`). FR-07's evaluation part (PB-16) is a manual
evaluation by design; its evidence is [`docs/ai-eval-report.md`](ai-eval-report.md) (§4.2), and FR-07 itself already has
`coverage.cy.ts` and `coverage-actions.cy.ts`.

## 4. Acceptance criteria → tests, per merged item

How to read this table:

- A criterion counts as covered when a passing test is **named after it** (`AC3: …` in an `it`/`describe` title). The
  table comes from the AC lists in `docs/tasks/PB-*.md` and the titles in `cypress/e2e/` and `tests/`.
- A title only shows a test was written for the criterion. Whether it really proves it was checked in PR review.
- **E2E**: a Cypress test names it (most also have Vitest tests). **Vitest only**: unit/integration tests name it, no
  Cypress test does.

| Item | ACs | Named in E2E | Vitest only | No named test |
|---|---|---|---|---|
| PB-02 Accounts and profiles | 9 | AC1, AC2, AC3, AC4, AC5, AC9 | AC6, AC7, AC8 | — |
| PB-03 Availability grid | 8 | AC1, AC2, AC3, AC7, AC8 | AC4, AC5, AC6 | — |
| PB-04 Teams, invites, join requests | 10 | AC1, AC2, AC3, AC4, AC5, AC8, AC10 | AC6, AC7, AC9 | — |
| PB-05 Task board | 10 | AC1, AC2, AC7, AC8, AC10 | AC3, AC4, AC5, AC6, AC9 | — |
| PB-06 Calendar and meeting finder (+ PB-06b) | 9 | AC1, AC5, AC6, AC8 (+ PB-06b month view) | AC2, AC3, AC4, AC7, AC9 | — |
| PB-07 Resources | 6 | AC1, AC2, AC4, AC5, AC6 | AC3 | — |
| PB-08 Notifications | 7 | AC1, AC3, AC4, AC7 | AC2, AC5, AC6 | — |
| PB-09 Activity history | 6 | AC1, AC2, AC4, AC6 | AC3, AC5 | — |
| PB-10 AI Coverage Check | 10 | AC1, AC3, AC5, AC7, AC10 | AC2, AC4, AC6, AC8, AC9 | — |
| PB-11 Suggestion → task, rating | 4 | AC1, AC2, AC3 | AC4 | — |
| PB-13 Milestones and templates | 4 | AC1, AC2, AC3, AC4 | — | — |
| PB-12 Team dashboard and home (#45) | 5 | AC1, AC2, AC4, AC5 | AC3 | — |
| PB-14 Group polls (#50) | 4 | AC1, AC2, AC3, AC4 (one test named "AC1–AC4") | — | — |
| PB-15 Meeting agenda and help-needed topics (#58) | 3 | AC1, AC2, AC3 | — | — |
| PB-16 AI evaluation set and report (#56) | 3 | — (manual evaluation, no E2E by design) | AC1, AC2, AC3 | — |

Every acceptance criterion of every merged item has at least one passing, named test.

### 4.1 PB-12, PB-14, PB-15 and PB-16: the named tests

All of these passed in the CI run in §2.

| Item · AC | E2E (`cypress/e2e/`) | Integration (`tests/integration/`) | Unit (`tests/unit/`) |
|---|---|---|---|
| PB-12 AC1: 7 tasks, 2 Done → 29 % | `dashboard.cy.ts` "AC1/AC2/AC4: the team overview matches the dashboard data, links overdue tasks to the board, and has text equivalents" | `dashboard.test.ts` "AC1: with 7 tasks of which 2 are Done, completion is 29%" | — |
| PB-12 AC2: overdue = due before now and not Done; links to the board | `dashboard.cy.ts` "AC1/AC2/AC4: …"; "AC2: an overdue task's link opens it on the board" | `dashboard.test.ts` "AC2: overdue = due before now and not Done, oldest first; due soon = the next 24 h" | `dashboard.test.ts` "AC2: overdue is due before now and not Done" |
| PB-12 AC3: open and overdue per member, including 0 | — | `dashboard.test.ts` "AC3: workload lists every member with open and overdue counts, including members with 0" | `dashboard.test.ts` "AC3: counts open and overdue per member, keeps members with 0, ignores Done and ex-members, sorts by name" |
| PB-12 AC4: text equivalents; no serious/critical axe issues | `dashboard.cy.ts` "AC1/AC2/AC4: …" (checks the workload table, runs `cy.checkPageA11y()`) | — | — |
| PB-12 AC5: only my assigned, not-Done tasks across my teams | `dashboard.cy.ts` "AC5: the personal home lists only my open tasks, across my teams" | `dashboard.test.ts` "AC5: lists only my assigned, not-Done tasks across my teams, soonest due first" | — |
| PB-14 AC1: 2–6 distinct options, future closing time | `polls.cy.ts` "AC1–AC4: create, vote, change vote, close early; the tie goes to the option listed first" | `polls.test.ts` "AC1: a poll needs 2–6 distinct options and a future closing time (400 with field errors)" | — |
| PB-14 AC2: one vote per member, changeable until close; 409 after | `polls.cy.ts` "AC1–AC4: …" | `polls.test.ts` "AC2: each member has one vote that can change until the poll closes"; "AC2: after closing, voting returns 409 “This poll has closed.”"; "AC2: a vote after the closing time closes the poll (lazy) and is rejected" | — |
| PB-14 AC3: the final choice goes to activity; members notified | `polls.cy.ts` "AC1–AC4: …" | `polls.test.ts` "AC3: closing early records the winner in activity and notifies members (not the closer)"; "AC3: a poll past its closing time is closed lazily on the next list, with the result in activity"; "AC3: concurrent lazy closes close once, log once, and notify once" | `polls.test.ts` "summarizes the result for activity history (AC3)" |
| PB-14 AC4: ties go to the first option; no votes → "No winner" | `polls.cy.ts` "AC1–AC4: …" | `polls.test.ts` "AC4: ties go to the option listed first; no votes → no winner" | `polls.test.ts` "AC4: a tie goes to the option listed first"; "AC4: no votes → no winner" |
| PB-15 AC1: items sorted by how many members flagged them | `agenda.cy.ts` "AC1/AC2: add topics, flag one, and it moves to the top — accessibly" | `agenda.test.ts` "AC1: items are sorted by how many members flagged them, then oldest first" | — |
| PB-15 AC2: a member can flag/unflag once; counts update | `agenda.cy.ts` "AC1/AC2: …" | `agenda.test.ts` "AC2: a member can flag and unflag once; sending it twice changes nothing"; "AC2: simultaneous flags from one member still count once" | `agenda.test.ts` "uses the right verb for one person and for several" (the count label) |
| PB-15 AC3: only the author or a leader can delete; another team's meeting → 404 | `agenda.cy.ts` "AC3: another member can't delete a topic, but a leader can" | `agenda.test.ts` "AC3: the author and a leader can delete; another member gets 403"; "AC3: a meeting from another team is 404 for every action" | — |
| PB-16 AC1: 30 labeled cases, 5 subjects, seeded gaps documented | — | — | `ai-eval.test.ts` "AC1: 30 labeled cases, 5 subjects of 6, all four work types, gaps documented"; "AC1: file names match ids, and seeded gaps exist beside clean drafts" |
| PB-16 AC2: one command produces the metrics file; the report's numbers match it | — | — | `ai-eval.test.ts` "AC2: $file holds metrics that follow from its own runs"; "AC2/AC3: the report's tables for $file match it exactly" (once per results file) |
| PB-16 AC3: the report says whether each target was met and what changed between prompt versions | — | — | `ai-eval.test.ts` "AC3: targets are met exactly at the threshold and not below it"; "AC2/AC3: the report's tables for $file match it exactly" |

### 4.2 PB-16: AI evaluation results (FR-07)

Copied exactly from [`docs/ai-eval-report.md`](ai-eval-report.md) (§3 Results, header table). That report has the method,
the confusion matrices, and the error analysis.

| | |
|---|---|
| Model / prompt | Claude Haiku 5.5 (`claude-haiku-5-5`) through `AI_PROVIDER=claude` · prompt `v1` |
| Date | 2026-11-04 (UTC) |
| Dataset | 30 cases, 143 labeled requirements, 39 of them Missing |
| Labels | **Human-reviewed by Devarsh Soni** on 2026-11-03: drafted by the AI agent, all 143 reviewed and kept, none changed |

| Metric | Target | Run 1 (`2026-11-04-v1.json`) | Run 2 (`2026-11-04-v1-run2.json`) | Met? |
|---|---|---|---|---|
| Missing recall | ≥ 0.85 | 0.949 (37/39) | 0.949 (37/39) | ✅ both runs |
| Missing precision | ≥ 0.80 | 0.902 (37/41) | 0.881 (37/42) | ✅ both runs |
| Quote verification rate | ≥ 95.0% | 100.0% (117/117) | 100.0% (115/115) | ✅ both runs |
| p95 latency | ≤ 30.0 s | 8.3 s | 8.2 s | ✅ both runs |
| Cost per full run (measured tokens) | — | $0.0214 | $0.0210 | — |

Helpfulness (PB-11 ratings): the report gives **n = 0, not available yet** (its §5), with the SQL to run once real ratings
exist. The usability sessions are the first chance to collect them.

## 5. Nonfunctional requirements

| NFR | Pass criterion | Procedure / script | Result | Status | Evidence |
|---|---|---|---|---|---|
| NFR-01 Performance | p95 < 800 ms, errors < 1 % (non-AI) at 100 VUs for 5 min | `perf/load.js` (k6) against staging seeded by `perf/seed-load.ts` (50 teams / 2,000 tasks) | **p95 93 ms**, **0.00 % errors** (0 of 26,739 API requests), checks 100 %. 100 VUs for 5 min (+30 s ramp up, 15 s down): 26,762 requests in 6 min 21 s (about 70 req/s), median 46 ms, max 1.46 s. Mix: board 6,112 · calendar 4,128 · activity 4,145 · notifications 4,052 (+ unread count) · task create + move 2,125 | ✅ **Met** (2026-11-03 23:17 CST) | [run 41777216556](https://github.com/tambevarad/studycrew/actions/runs/41777216556) (`load` job, artifact `k6/k6-summary.json`), on `feat/PB-17-final-results` @ `a686702`, run with nothing else hitting staging. Staging served `main` @ `703ec91` (Vercel + Neon us-east-1); k6 ran on a GitHub-hosted runner. A second run, [run 41777022628](https://github.com/tambevarad/studycrew/actions/runs/41777022628) (k6 overlapped ZAP's ~90 s crawl), gave p95 111 ms, 0 of 26,485 failed. Sign-in calls are excluded (`kind:auth`): `setup()` signs the 10 load users in once and waits out Better Auth's rate limit (3 × 429, expected). Load data seeded 2026-11-03 ~23:01 CST |
| NFR-02 Security | 0 high/critical findings; 100 % of team routes → 403 for non-members | Authz sweep (exists); OWASP ZAP baseline against staging; `npm audit --omit=dev`; grep `.next/static` for key patterns | Authz sweep: **28/28 team route files → 403** for non-members; **42/42 v1 route files → 401** signed out. **ZAP baseline: 0 High**, 2 Medium (CSP header not set; `Access-Control-Allow-Origin: *` on static files), 4 Low (Permissions-Policy, COOP, COEP, CORP headers), 12 Informational, one of which is a real defect (password in the URL, **D-06**). **`npm audit --omit=dev`: 0** at every severity (290 production packages). **Client-bundle scan: PASS**: 41 files, no key-shaped strings, none of the 3 server-only env values present (1 warning: Better Auth's client SDK names `BETTER_AUTH_SECRET`, name only) | ✅ **Met**: 0 high/critical, 100 % → 403. ⚠️ Open: D-06 (password in URL before hydration), D-07 (missing security headers) | [run 41777216556](https://github.com/tambevarad/studycrew/actions/runs/41777216556) (`zap`: artifact `zap-baseline`; `audit`: `npm-audit/npm-audit.json`; `bundle-scan`: job log). The same alert types (0 High) in [run 41777022628](https://github.com/tambevarad/studycrew/actions/runs/41777022628) and [run 41774963775](https://github.com/tambevarad/studycrew/actions/runs/41774963775). ZAP is passive (no attack rules) plus the AJAX spider. `authz-sweep.test.ts` (§2) |
| NFR-03 Accessibility | Lighthouse a11y ≥ 90; 0 serious/critical axe issues | Lighthouse CI on 6 main pages (`lighthouserc.json`, `perf/lighthouserc.public.json`); axe sweep over 19 pages (`cypress/e2e/a11y-sweep.cy.ts`) | Lighthouse accessibility **100 on all 6 pages, in every run** (desktop, 3 runs per page): **/sign-in** (signed out), **/dashboard, /teams, team board, team calendar, /notifications** (signed in as the demo account). Performance, best practices, and SEO are also 100 on all 6. Each audit's final URL was checked to be the page itself. The 19-page axe sweep passes in every CI `e2e` (§2) | ✅ **Met** (2026-11-03 23:43 CST) | [run 41780610747](https://github.com/tambevarad/studycrew/actions/runs/41780610747) (`lighthouse` artifact: `lighthouse-public/` and `lighthouse/`, each with `manifest.json` + one report per run), on `feat/PB-17-final-results` @ `1f64002`, against staging @ `703ec91`. An earlier run, [run 41777216556](https://github.com/tambevarad/studycrew/actions/runs/41777216556), measured the same 5 signed-in pages at 100 but its "/sign-in" audit was redirected to /dashboard (already signed in), so that one isn't counted. Supporting: all 15 Cypress specs run `cy.checkPageA11y()` (serious + critical) and pass in §2's CI run; the sweep's first local run found D-05 (fixed) |
| NFR-04 Usability | ≥ 80 % finish the core flow in 10 min; mean SUS ≥ 70 | Moderated test with ≥ 5 students: `docs/process/usability-test.md` (script, 5 tasks, consent, SUS, timing sheet) | — | ⏳ **Krish**: plan ready, sessions not run | Results go in `usability-test.md` §9 and are copied here |
| NFR-05 Reliability | AI failures handled; ≥ 99 % uptime | PB-10 timeout and failure tests (exist); UptimeRobot monitor on `/api/health` every 5 min (`docs/process/deployment.md`), uptime for the last 4 weeks | AI failure handling: **passing**. Uptime: — | ✅ AI failure tests · ⏳ **pending, Varad** (uptime from the public status page) | `coverage.test.ts` "PB-10 failure handling (AC5)" (4 tests: timeout → 502 + FAILED report, missing key, app keeps working, error envelope); `coverage.cy.ts` "AC5: an AI failure is shown inline" |
| NFR-06 Maintainability | ≥ 70 % lines; CI green on every merge | Coverage gate in CI (`test:coverage`); CI history on `main` | **96.56 % lines**; **35/37** runs on `main` green (1 red: D-02; 1 cancelled) | ✅ coverage · ⚠️ CI history: one red run on a docs-only merge (D-02) | §2. Refresh on the final commit |

## 6. Open defects

| ID | Found | Area (owner) | What happens | Severity | Status / next step |
|---|---|---|---|---|---|
| D-01 | 2026-11-01, Krish (reading `/join/[inviteCode]` while writing the usability script) | Invite links: PB-04 join page (Dev); shared `src/server/session.ts` (tech lead) | Signed out, opening `/join/<code>` redirects to `/sign-in` **without** `?next=`. Checked locally: `307 Location: /sign-in`. After signing up, the student lands on `/profile?welcome=1` and isn't on the team; they have to open the invite link again. The auth form already supports `?next=`; `requirePageUser()` doesn't pass it. `teams.cy.ts` signs in first, so it doesn't catch this. | 3 (major): first step of the core flow (usability T1) | **Fixed** in [#48](https://github.com/tambevarad/studycrew/pull/48) (contract: `src/proxy.ts` adds `?next=` before the `(app)` layout redirects; same-origin `safeNextPath` in `src/lib/safe-next.ts`) and [#49](https://github.com/tambevarad/studycrew/pull/49) (PB-04: `teams.cy.ts` "D-01: … signs up, and ends up on the team"), both merged. Checked on staging @ `5cd4cae` in the usability dry run (`docs/process/usability-test.md` §3.1). PB-02 follow-up (the sign-in form's own `safeNextPath` accepted a tab or newline before `//evil.com`): done in [#54](https://github.com/tambevarad/studycrew/pull/54) |
| D-02 | 2026-10-23, CI | `coverage.cy.ts` "AC5: an AI failure is shown inline" (Devarsh, PB-10) | One red `e2e` run on `main` ([run 39914422898](https://github.com/tambevarad/studycrew/actions/runs/39914422898), docs-only commit `401f471`): "1 accessibility violation". Likely cause: the error toast is still fading in when axe runs. `docs/contract-requests/PB-02-toast-contrast.md` says specs must wait for toasts first, and this test doesn't. Not reproduced since; the next 4 runs are green. | 1 (test flake, no user impact) | **Fix in [#53](https://github.com/tambevarad/studycrew/pull/53)**: toast wait added, and on failure the test now names the axe rule and elements. Root cause still unknown: this flow fires no toast, and it didn't reproduce under a slow refresh or 4–20× CPU throttling. Tracked in [#59](https://github.com/tambevarad/studycrew/issues/59) |
| D-03 | 2026-11-01, Krish (PB-12) | Loading skeletons: `teams/[teamId]/board/loading.tsx`, `notifications/loading.tsx` (Krish), `teams/[teamId]/coverage/loading.tsx` (Devarsh) | Each puts `aria-label` on a `<div>` with no role: axe `aria-prohibited-attr` (serious) whenever a check runs while the skeleton shows. The same pattern failed `smoke.cy.ts` on PB-12's first skeleton; fixed there with `role="status"`. | 2 (minor: only while loading, but counts against NFR-03) | **Fixed**: board and notifications in [#47](https://github.com/tambevarad/studycrew/pull/47), coverage in [#53](https://github.com/tambevarad/studycrew/pull/53), each checked with axe on the real skeleton before and after |
| D-04 | 2026-11-01, Krish (test report) | `cypress/e2e/board.cy.ts` (Krish, PB-05) | The board spec still excludes the sidebar (`aside`) from axe. That workaround was for the sidebar contrast bug, which #20 fixed, so the board page's sidebar isn't checked. (`smoke.cy.ts` does check the sidebar on a team page.) | 1 (test gap) | **Fixed** in [#47](https://github.com/tambevarad/studycrew/pull/47) (merged): `board.cy.ts` is back on `cy.checkPageA11y()` and passes with the sidebar included |
| D-05 | 2026-11-03, Dev (the new 19-page axe sweep, `cypress/e2e/a11y-sweep.cy.ts`, run while writing PB-17) | Team Members page: `src/components/features/teams/members-view.tsx` (Dev, PB-04) | The leader's "Make leader" / "Make member" buttons have the accessible name "Make Krish Ruparel a leader", which doesn't contain the visible text "Make leader": axe `label-content-name-mismatch` (serious, WCAG 2.5.3 Label in Name). A voice-control user saying "click Make leader" can't activate it. `teams.cy.ts` only ran axe on a one-person team (no such buttons), so it didn't catch this. | 2 (minor: one control, but counts against NFR-03) | **Fixed** in [#51](https://github.com/tambevarad/studycrew/pull/51) (merged): names now start with the visible text ("Make leader: Krish Ruparel"), and `teams.cy.ts` runs axe after a second member joins |
| D-06 | 2026-11-03, Dev (ZAP baseline in the NFR-02 run, alert 10024 "Sensitive Information in URL") | Sign-in and sign-up forms: `src/components/features/auth/auth-form.tsx` (Krish, PB-02) | The `<form>` has no `method`, so if it's submitted before React has hydrated (slow connection, script error), the browser falls back to a native GET and puts the email and **password in the URL** (`/sign-in?email=…&password=…`). The URL lands in browser history and server logs. ZAP's spider, which submits forms without running JavaScript, did exactly this on `/sign-in` and `/sign-up` in all three runs | 3 (major: credentials can be logged; needs a submit before hydration) | **Fixed in [#69](https://github.com/tambevarad/studycrew/pull/69)** (merged): `method="post"` on the sign-in and sign-up `<form>`; `onSubmit` still prevents the native submit and uses fetch, so hydrated behaviour is unchanged. Test: `auth.cy.ts` "D-06: the sign-in and sign-up forms use method=post, so fields never go in the URL" (failed on a build without the fix, passes with it). Checked on staging at `24b2342` on Nov 7: both forms POST, and sign-in and sign-up work. ZAP not re-run yet |
| D-07 | 2026-11-03, Dev (ZAP baseline, NFR-02 run) | HTTP response headers: `next.config.ts` (shared config, tech lead) | No `Content-Security-Policy` (ZAP Medium) and no `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `-Embedder-Policy`, or `-Resource-Policy` (Low). Also Medium: `Access-Control-Allow-Origin: *` on `/_next/static` files and the favicon (Vercel's default for static assets; they're public and the bundle scan found no secrets in them) | 2 (minor: defence in depth; doesn't fail NFR-02) | **Phase 1 in [#68](https://github.com/tambevarad/studycrew/pull/68)** (open; request `docs/contract-requests/PB-17-security-headers.md`). Fix (contract request, shared `next.config.ts`): extend its `headers()`, which already sends `nosniff`, `X-Frame-Options: DENY`, and a `Referrer-Policy`, with `Permissions-Policy` (camera, microphone, geolocation off), `Cross-Origin-Opener-Policy: same-origin`, and a CSP, first as `Content-Security-Policy-Report-Only` because Next's inline scripts need nonces. Then rerun ZAP. The static-file CORS header is accepted as is |

**Open contract requests (workarounds in place, not defects):**

- `PB-04-update-team-isopen-default.md`: the PATCH route keeps a closed team closed. Covered by `teams.test.ts`. Tracked in [#60](https://github.com/tambevarad/studycrew/issues/60).
- `PB-06-dialog-ids-and-date-helpers.md`: `FindTimeDialog` is mounted only while open. Tracked in [#61](https://github.com/tambevarad/studycrew/issues/61).

**Resolved:**

- PB-02 toast contrast (#29).
- PB-05 sidebar contrast and E2E sign-in rate limit (#20).
- PB-02 smoke sign-in rate limit (#37).
- PB-04 invite links lose `?next=` for signed-out visitors (`PB-04-join-next-redirect.md`): contract in #48, PB-04 part in #49.
