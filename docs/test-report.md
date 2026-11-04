# Test report (PB-17)

> **Status: draft, 2026-11-03, `main` @ `0583127`.** The FR traceability for merged items (§3, §4) and the CI and
> coverage evidence (§2) are filled in. NFR results that come from later runs are marked **⏳ pending** with the
> owner who will fill them in (§5). Nothing marked pending has been run yet; nothing in this file is estimated.
>
> Owner: Krish Ruparel (test report, usability) · Dev Patel (NFR-01/02/03/05 scripts and runs)

**Legend:** ✅ passing, with evidence linked · ⚠️ met with an exception (explained) · ❌ failing · ⏳ pending (owner and
when).

## 0. Still to fill in

| # | What | Who | When / trigger |
|---|---|---|---|
| 1 | NFR-01 k6 load test result (`perf/load.js`, `perf/seed-load.ts`) | Dev | Scripts in #52. **Pending final run** after PB-14, PB-15, PB-16 merge (needs the load seed on staging; ask Dev) |
| 2 | NFR-02 OWASP ZAP baseline, `npm audit --omit=dev`, client-bundle secret scan | Dev | Scripts in #52. **Pending final run** after PB-14, PB-15, PB-16 merge (`nfr.yml`) |
| 3 | NFR-03 Lighthouse CI on 6 pages (`lighthouserc.json`) and the 19-page axe sweep (`cypress/e2e/a11y-sweep.cy.ts`) | Dev | Files in #52 (the sweep then runs in every CI `e2e`). **Pending final run** (Lighthouse on staging) after PB-14, PB-15, PB-16 merge |
| 4 | NFR-04 usability sessions (≥ 5 students) and SUS: copy the §9.2 summary from `docs/process/usability-test.md` | Krish | after the sessions |
| 5 | NFR-05 uptime export for the last 4 weeks (UptimeRobot on `/api/health`) | Dev | end of Sprint 5 |
| 6 | FR rows for **PB-15** and **PB-16** (§3, §4). PB-12 and PB-14 are done | Krish | as each one merges |
| 7 | Refresh §2 (test counts, coverage, CI history) on the **final** `main` commit | Krish | before the final report |
| 8 | File GitHub issues for the defects still open in §6 (D-02; D-03's coverage part) and link them; mark D-01's PB-02 follow-up done when #54 merges | Krish | now / after #54 |

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

## 2. Automated suites on `main` @ `0583127`

| Suite | Result | Evidence |
|---|---|---|
| Vitest unit + integration | **397 tests in 38 files, all passing** | CI `integration` job (`test:coverage`) in [run 41765676320](https://github.com/tambevarad/studycrew/actions/runs/41765676320), 2026-11-04 03:12 UTC (latest green run on `main`) |
| Coverage | **96.56 % lines** (1180/1222) · 95.78 % statements · 88.86 % branches · 97.03 % functions | Same CI job; it uploads the `coverage` artifact |
| Cypress E2E | **68 tests in 15 specs, all passing** ("All specs passed!", 68/68; 20 of them are the 19-page axe sweep) | CI `e2e` job in [run 41765676320](https://github.com/tambevarad/studycrew/actions/runs/41765676320) |
| Authorization sweep (NFR-02) | Discovers routes automatically: all **42** `route.ts` files under `api/v1/` return 401 when signed out, and all **28** under `teams/[teamId]/` return 403 to a non-member, on every method | `tests/integration/authz-sweep.test.ts`, in the same run |
| CI history on `main` | **33 of 34** runs green; 1 red `e2e` run (see D-02) | `gh run list --workflow ci.yml --branch main`, 2026-11-03 |

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
| FR-07 | AI Coverage Check: run, report, turn a gap into a task, rate it, evaluate | Must | PB-10 (#34), PB-11 (#42); PB-16 ⏳ | `coverage.cy.ts` (3), `coverage-actions.cy.ts` (2) | `coverage.test.ts`, `coverage-actions.test.ts` | `coverage-quotes.test.ts`, `coverage-scoring.test.ts`, `coverage-providers.test.ts`, `mock-model.test.ts`, `coverage-actions.test.ts` | ✅ check + actions · ⏳ evaluation (PB-16 runs manually with `npm run ai:eval`, never in CI) |
| FR-08 | Milestones and templates | Should | PB-13 (#43) | `milestones.cy.ts` (4) | `milestones.test.ts` | `milestones.test.ts` | ✅ |
| FR-09 | Group polls | Should | PB-14 (#50) | `polls.cy.ts` (1) | `polls.test.ts` | `polls.test.ts` | ✅ |
| FR-10 | Meeting agenda and help-needed topics | Could | PB-15 ⏳ | — | — | — | ⏳ not merged |
| (all) | Foundation: shell, auth guard, health, permissions, helpers | — | PB-01 (#18, #20, #39) | `smoke.cy.ts` (5) | `foundation.test.ts`, `health.test.ts`, `authz-sweep.test.ts` | `foundation.test.ts` | ✅ |

**PB-17 AC2** ("every Must FR links to at least one passing E2E spec"): **met for FR-01 … FR-07 on `0583127`**,
including the PB-12 dashboard part of FR-06 (`dashboard.cy.ts`). Still to add: PB-16 for FR-07, which is a manual
evaluation, not an E2E flow.

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
| PB-15 Agenda · PB-16 AI evaluation | — | ⏳ not merged | | |

Every acceptance criterion of every merged item has at least one passing, named test.

### 4.1 PB-12 and PB-14: the named tests

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

## 5. Nonfunctional requirements

| NFR | Pass criterion | Procedure / script | Result | Status | Evidence |
|---|---|---|---|---|---|
| NFR-01 Performance | p95 < 800 ms, errors < 1 % (non-AI) at 100 VUs for 5 min | `perf/load.js` (k6) against staging seeded by `perf/seed-load.ts` (50 teams / 2,000 tasks) | — | ⏳ **Pending final run** (scripts in #52; run after PB-14/15/16 merge) | Supporting only, not the NFR-01 result: `meeting-finder.test.ts` "AC9 (NFR-01): 8 members over 14 days in under 300 ms" passes |
| NFR-02 Security | 0 high/critical findings; 100 % of team routes → 403 for non-members | Authz sweep (exists); OWASP ZAP baseline against staging; `npm audit --omit=dev`; grep `.next/static` for key patterns | Authz sweep: **28/28 team route files → 403** for non-members; **42/42 v1 route files → 401** signed out. ZAP / audit / bundle scan: — | ✅ sweep · ⏳ **Pending final run**: ZAP, audit, scan (scripts in #52, `nfr.yml`) | `authz-sweep.test.ts` (§2). Related tests: `profile.test.ts` "AC1/AC8: … only a password hash … HttpOnly, SameSite=Lax"; `coverage.test.ts` "AC3: without the consent box … nothing is sent to the provider" |
| NFR-03 Accessibility | Lighthouse a11y ≥ 90; 0 serious/critical axe issues | Lighthouse CI on 6 main pages (`lighthouserc.json`); axe sweep over 19 pages (`cypress/e2e/a11y-sweep.cy.ts`) | — | ⏳ **Pending final run** (Lighthouse; files in #52). The 19-page axe sweep (`a11y-sweep.cy.ts`, #52) now runs in every CI `e2e` and passes in §2's run; its first local run found D-05 (fixed) | Supporting: all 15 specs run `cy.checkPageA11y()` (serious + critical), including the sweep, all passing in §2's CI run. See D-03 for the one skeleton still open |
| NFR-04 Usability | ≥ 80 % finish the core flow in 10 min; mean SUS ≥ 70 | Moderated test with ≥ 5 students: `docs/process/usability-test.md` (script, 5 tasks, consent, SUS, timing sheet) | — | ⏳ **Krish**: plan ready, sessions not run | Results go in `usability-test.md` §9 and are copied here |
| NFR-05 Reliability | AI failures handled; ≥ 99 % uptime | PB-10 timeout and failure tests (exist); UptimeRobot monitor on `/api/health` every 5 min (`docs/process/deployment.md`), export for the last 4 weeks | AI failure handling: **passing**. Uptime: — | ✅ AI failure tests · ⏳ **Dev**: uptime export | `coverage.test.ts` "PB-10 failure handling (AC5)" (4 tests: timeout → 502 + FAILED report, missing key, app keeps working, error envelope); `coverage.cy.ts` "AC5: an AI failure is shown inline" |
| NFR-06 Maintainability | ≥ 70 % lines; CI green on every merge | Coverage gate in CI (`test:coverage`); CI history on `main` | **96.56 % lines**; **33/34** runs on `main` green | ✅ coverage · ⚠️ CI history: one red run on a docs-only merge (D-02) | §2. Refresh on the final commit |

## 6. Open defects

| ID | Found | Area (owner) | What happens | Severity | Status / next step |
|---|---|---|---|---|---|
| D-01 | 2026-11-01, Krish (reading `/join/[inviteCode]` while writing the usability script) | Invite links: PB-04 join page (Dev); shared `src/server/session.ts` (tech lead) | Signed out, opening `/join/<code>` redirects to `/sign-in` **without** `?next=`. Checked locally: `307 Location: /sign-in`. After signing up, the student lands on `/profile?welcome=1` and isn't on the team; they have to open the invite link again. The auth form already supports `?next=`; `requirePageUser()` doesn't pass it. `teams.cy.ts` signs in first, so it doesn't catch this. | 3 (major): first step of the core flow (usability T1) | **Fixed** in [#48](https://github.com/tambevarad/studycrew/pull/48) (contract: `src/proxy.ts` adds `?next=` before the `(app)` layout redirects; same-origin `safeNextPath` in `src/lib/safe-next.ts`) and [#49](https://github.com/tambevarad/studycrew/pull/49) (PB-04: `teams.cy.ts` "D-01: … signs up, and ends up on the team"), both merged. Checked on staging @ `5cd4cae` in the usability dry run (`docs/process/usability-test.md` §3.1). PB-02 follow-up (the sign-in form's own `safeNextPath` accepted a tab or newline before `//evil.com`): [#54](https://github.com/tambevarad/studycrew/pull/54), open |
| D-02 | 2026-10-23, CI | `coverage.cy.ts` "AC5: an AI failure is shown inline" (Devarsh, PB-10) | One red `e2e` run on `main` ([run 39914422898](https://github.com/tambevarad/studycrew/actions/runs/39914422898), docs-only commit `401f471`): "1 accessibility violation". Likely cause: the error toast is still fading in when axe runs. `docs/contract-requests/PB-02-toast-contrast.md` says specs must wait for toasts first, and this test doesn't. Not reproduced since; the next 4 runs are green. | 1 (test flake, no user impact) | Open. Devarsh to add the toast wait before `cy.checkPageA11y()` |
| D-03 | 2026-11-01, Krish (PB-12) | Loading skeletons: `teams/[teamId]/board/loading.tsx`, `notifications/loading.tsx` (Krish), `teams/[teamId]/coverage/loading.tsx` (Devarsh) | Each puts `aria-label` on a `<div>` with no role: axe `aria-prohibited-attr` (serious) whenever a check runs while the skeleton shows. The same pattern failed `smoke.cy.ts` on PB-12's first skeleton; fixed there with `role="status"`. | 2 (minor: only while loading, but counts against NFR-03) | Board and notifications: **Fixed** in [#47](https://github.com/tambevarad/studycrew/pull/47) (merged), checked with axe on the real skeletons before and after. Coverage: open, Devarsh to add `role="status"` |
| D-04 | 2026-11-01, Krish (test report) | `cypress/e2e/board.cy.ts` (Krish, PB-05) | The board spec still excludes the sidebar (`aside`) from axe. That workaround was for the sidebar contrast bug, which #20 fixed, so the board page's sidebar isn't checked. (`smoke.cy.ts` does check the sidebar on a team page.) | 1 (test gap) | **Fixed** in [#47](https://github.com/tambevarad/studycrew/pull/47) (merged): `board.cy.ts` is back on `cy.checkPageA11y()` and passes with the sidebar included |
| D-05 | 2026-11-03, Dev (the new 19-page axe sweep, `cypress/e2e/a11y-sweep.cy.ts`, run while writing PB-17) | Team Members page: `src/components/features/teams/members-view.tsx` (Dev, PB-04) | The leader's "Make leader" / "Make member" buttons have the accessible name "Make Krish Ruparel a leader", which doesn't contain the visible text "Make leader": axe `label-content-name-mismatch` (serious, WCAG 2.5.3 Label in Name). A voice-control user saying "click Make leader" can't activate it. `teams.cy.ts` only ran axe on a one-person team (no such buttons), so it didn't catch this. | 2 (minor: one control, but counts against NFR-03) | **Fixed** in [#51](https://github.com/tambevarad/studycrew/pull/51) (merged): names now start with the visible text ("Make leader: Krish Ruparel"), and `teams.cy.ts` runs axe after a second member joins |

**Open contract requests (workarounds in place, not defects):**

- `PB-04-update-team-isopen-default.md`: the PATCH route keeps a closed team closed. Covered by `teams.test.ts`.
- `PB-06-dialog-ids-and-date-helpers.md`: `FindTimeDialog` is mounted only while open.

**Resolved:**

- PB-02 toast contrast (#29).
- PB-05 sidebar contrast and E2E sign-in rate limit (#20).
- PB-02 smoke sign-in rate limit (#37).
- PB-04 invite links lose `?next=` for signed-out visitors (`PB-04-join-next-redirect.md`): contract in #48, PB-04 part in #49.
