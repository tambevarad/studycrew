# Ownership map

Who builds what (from the proposal's §8 and Attachment A.3), which files each item owns, and which tables it may write.
If a path isn't listed for your item, **don't edit it** (see CLAUDE.md rule 1).

| Code | Person | GitHub | Role |
|---|---|---|---|
| M1 | Varad Tambe | @tambevarad | Product Owner, full-stack (repo admin) |
| M2 | Krish Ruparel | @Krishr21 | Scrum Master, QA lead |
| M3 | Dev Patel | @devjpatell | Tech lead, backend/DevOps |
| M4 | Devarsh Soni | @Mercapt-0 | AI lead, frontend |

## By backlog item

`<route>` means everything under `src/app/api/v1/<route>/` (route files) and `src/app/(app)/<page>/` (pages).

| Item | Owner | Sprint (re-baselined) | Owns (create/edit only these) | Writes tables |
|---|---|---|---|---|
| PB-01 | M3 Dev (foundation by M1+AI, see note) | 3 | `.github/**`, `docker-compose.yml`, `vercel.json`, `docs/process/deployment.md` | — |
| PB-02 | M2 Krish | 3 | api `me/profile/`; pages `(auth)/**`, `(app)/profile/`; `src/components/features/{auth,profile}/`; `src/server/services/profile/` | `user` (profile fields) |
| PB-03 | M2 Krish | 3 | api `me/availability/`, `teams/[teamId]/availability/`; page `(app)/availability/`; `components/features/availability/`; `services/availability/` | `availability` |
| PB-04 | M3 Dev | 3 | api `teams/route.ts`, `teams/[teamId]/route.ts`, `teams/[teamId]/{invites,invite-code,join-requests,members}/`, `join/`, `join-requests/`, `me/{invites,join-requests}/`; pages `(app)/teams/page.tsx`, `(app)/teams/new/`, `(app)/join/`, `(app)/teams/[teamId]/members/`; `components/features/teams/`; `services/teams/` | `team`, `team_member`, `team_invite`, `join_request` |
| PB-05 | M4 Devarsh | 3 | api `teams/[teamId]/tasks/`; page `(app)/teams/[teamId]/board/`; `components/features/tasks/`; `services/tasks/` | `task`, `task_assignee` |
| PB-06 | M1 Varad | 3 | api `teams/[teamId]/{meetings,meeting-suggestions}/` (except `meetings/[meetingId]/agenda/`); page `(app)/teams/[teamId]/calendar/`; `components/features/meetings/`; `services/meetings/` | `meeting`, `meeting_rsvp` |
| PB-07 | M4 Devarsh | 3 | api `teams/[teamId]/resources/`; page `(app)/teams/[teamId]/resources/`; `components/features/resources/`; `services/resources/` | `resource` |
| PB-08 | M2 Krish | 3 | api `me/notifications/`; page `(app)/notifications/`; `components/features/notifications/` (keep `NotificationBell` export); `services/notifications/` | `notification` (read state, due-soon) |
| PB-09 | M1 Varad | 3 | api `teams/[teamId]/activity/`; page `(app)/teams/[teamId]/activity/`; `components/features/activity/` (keep `RecentActivity` export); `services/activity/` | — (reads only) |
| PB-10 | M4 Devarsh (M3 pairs) | 3 | api `teams/[teamId]/coverage-reports/`; pages `(app)/teams/[teamId]/coverage/`; `components/features/coverage/`; `services/coverage/`; `src/server/ai/**` | `coverage_report`, `coverage_item` |
| PB-11 | M1 Varad | 4 | api `teams/[teamId]/coverage-items/`; `components/features/coverage-actions/` (keep `CoverageItemActions` export); `services/coverage-actions/` | `coverage_item` (taskId, rating); tasks via `createTask` |
| PB-12 | M2 Krish | 4 | api `teams/[teamId]/dashboard/`; pages `(app)/dashboard/`, `(app)/teams/[teamId]/page.tsx`; `components/features/dashboard/`; `services/dashboard/` | — |
| PB-13 | M1 Varad | 4 | api `teams/[teamId]/milestones/`; page `(app)/teams/[teamId]/milestones/`; `components/features/milestones/`; `services/milestones/` | `milestone`; task links via PB-05 `updateTask` |
| PB-14 | M3 Dev | 4 | api `teams/[teamId]/polls/`; page `(app)/teams/[teamId]/polls/`; `components/features/polls/`; `services/polls/` | `poll`, `poll_option`, `poll_vote` |
| PB-15 | M4 Devarsh | 4 | api `teams/[teamId]/meetings/[meetingId]/agenda/`; `components/features/agenda/` (keep `MeetingAgenda` export); `services/agenda/` | `agenda_item`, `agenda_help_flag` |
| PB-16 | M4 Devarsh | 5 | `tests/ai-eval/**`, `scripts/ai-eval.ts`, `docs/ai-eval-report.md` | — |
| PB-17 | M3 Dev + M2 Krish | 5 | `perf/**`, `security/**`, `lighthouserc.json`, `docs/process/usability-test.md`, `docs/test-report.md` | — |

Each item also owns its own tests: `tests/unit/<item-slug>*.test.ts`, `tests/integration/<item-slug>*.test.ts`,
`cypress/e2e/<item-slug>*.cy.ts`, plus `docs/tasks/PB-XX.md` (Implementation notes section) and `docs/ai-log/PB-XX.md`.

**Note on PB-01:** the shared foundation (schema, contracts, server core, UI kit, app shell, test harness, CI file)
was built by Varad with Claude Code on Oct 22 as the "contracts" PR so the four of us could work in parallel. Dev, as tech
lead and PB-01 owner, reviews/merges it and then owns the remaining PB-01 work: Neon + Vercel staging, branch
protection, CI hardening. This split is recorded honestly in the progress report.

## Shared files (frozen after the foundation PR)

`prisma/**`, `src/contracts/**`, `src/server/*.ts`, `src/server/shared/**`, `src/components/ui/**`,
`src/components/app-shell/**`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/(app)/layout.tsx`,
`src/app/(app)/teams/[teamId]/layout.tsx`, `src/app/api/auth/**`, `src/app/api/health/**`, `src/lib/**`, `tests/helpers/**`,
`tests/integration/authz-sweep.test.ts`, `cypress/support/**`, `package.json`, `package-lock.json`, config files,
`CLAUDE.md`, `AGENTS.md`, `docs/contracts/**`, `docs/process/**`.

Changes go through a contract request → separate PR approved by the tech lead (Dev) and product owner (Varad).

## Review pairs (every PR needs one approval from someone who can explain it)

| Author | Reviewer | `gh pr create --reviewer` |
|---|---|---|
| Varad | Krish | `Krishr21` |
| Krish | Dev | `devjpatell` |
| Dev | Devarsh | `Mercapt-0` |
| Devarsh | Varad | `tambevarad` |
