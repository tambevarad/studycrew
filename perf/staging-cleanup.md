# Staging cleanup list (PB-17)

Test data that the PB-17 runs and the usability test leave on **staging** (`https://studycrew-staging.vercel.app`),
which is also the demo site. **Nothing here has been deleted. Don't delete anything until Dev approves**, and never
"clean up" by re-running `prisma/seed.ts`: it wipes all data, the demo teams included.

StudyCrew has no "delete team" or "delete account" feature, so rows marked **DB** need a reviewed script run by Dev
with the Neon direct URL. Rows marked **App** can be undone in the app itself, with no database access.

## 1. Load-test data (`perf/seed-load.ts`, NFR-01)

Everything is recognizable by name. Counts are what the seeder creates. Fill in the date once it has run on staging.

| What | How to recognize it | Count | Undo |
|---|---|---|---|
| Users | email `load-01@studycrew.test` … `load-10@studycrew.test`, name "Load User NN" | 10 (+ 10 credential `account` rows) | DB |
| Teams | course `LOAD 9000`, name `Load Team 01` … `Load Team 50`, private (`isOpen: false`) | 50 (+ 100 memberships) | DB |
| Tasks | in those teams, title `Load task NN-NNN` | 2,000 | DB (go with the team) |
| Meetings | in those teams, title `Load meeting 1` … `6` | 300 | DB (go with the team) |
| Activity | in those teams, "created “Load task …”" | 1,000 | DB (go with the team) |

Seeded on staging: **2026-11-03, about 11:01 pm CST, by Dev** (`npx tsx perf/seed-load.ts`). An earlier attempt the
same evening didn't reach Neon (it found 0 load users), so there is exactly one copy.

## 2. Left by the NFR runs (`nfr.yml`)

| Run | What it leaves | Undo |
|---|---|---|
| k6 load test | **4,146 tasks** titled `k6 task <vu>-<iteration>` in the load teams (2,021 from run 41777022628, 2,125 from run 41777216556), each created and then moved, with their activity rows. Sign-in sessions for the load users (10 per run) | DB, with the load teams. Sessions expire on their own |
| Lighthouse | Sign-in sessions for the demo account `varad@studycrew.test` (one from the workflow's team lookup, one per Chrome run) | None needed: sessions expire |
| ZAP baseline | Passive scan. Its spider submitted the sign-in and sign-up forms as plain GETs (`?email=zaproxy@example.com…`, see D-06), which only load the page, so no account should exist. **Check anyway**: users created during the three ZAP jobs (04:44, 05:05, 05:11 UTC on Nov 4) whose email isn't `@studycrew.test`. Expected: none | DB, only if any show up |
| npm audit, bundle scan | Nothing on staging (they run on the GitHub runner) | — |

Runs: [41774963775](https://github.com/tambevarad/studycrew/actions/runs/41774963775) (04:44–04:46 UTC Nov 4; k6 stopped
at its first sign-in), [41777022628](https://github.com/tambevarad/studycrew/actions/runs/41777022628) (05:04–05:11), and
[41777216556](https://github.com/tambevarad/studycrew/actions/runs/41777216556) (05:11–05:24). Plus the /sign-in
Lighthouse rerun, if it happens.

## 3. Usability dry run (`docs/process/usability-test.md` §3.1, Nov 3)

All in the seeded demo team **Query Optimizers**. Undoing these puts the demo team back to how the seed made it.

| What | Undo |
|---|---|
| Olivia Outsider (`outsider@studycrew.test`) is a **member** of Query Optimizers | App: as Maya (leader), Members → Remove Olivia |
| Olivia's availability changed from the seeded Mon–Fri 6–10 PM + Sat to Mon–Thu 6–9 PM | App: as Olivia, My availability → set it back (the seeded slots are in `prisma/seed.ts`) |
| Meeting "Kickoff", Wed Nov 4, 6:30–7:30 PM CT, and Maya's "meeting scheduled" notification | App: as the organizer (Olivia), cancel the meeting. The notification stays (DB to remove) |
| Task "Draft the introduction" (In Progress, assigned to Olivia, due Nov 6) | DB (or leave it: it looks like ordinary demo data) |
| Coverage report "Remote work essay" | DB |
| Activity rows for all of the above ("joined the team", "scheduled", "created", "moved", …) | DB (activity is a history, so it can't be undone in the app) |

## 4. Usability sessions (Krish, after the sessions)

The script (§3) creates one set per participant P#. Krish fills in this table after the last session.

| What | How to recognize it | Undo |
|---|---|---|
| Participant accounts | `p1.usability@studycrew.test` … `p6.usability@studycrew.test` (Krish's plan on issue #17; P6 is a spare) | DB |
| Teams | `Usability P1` … `Usability P6` in `CSE 6324` | DB (tasks, meetings, coverage reports, activity, and notifications go with the team) |
| Helper accounts, if any | Krish lists them here | DB |
| Changes to the moderator's own account (availability, team memberships) | Krish lists them here | App |

## How the DB deletes will work (not written yet)

One script, reviewed in a PR before anyone runs it: it selects by the names and emails above, prints the counts, and
deletes inside one transaction. It deletes teams first, so their tasks, meetings, members, activity, polls, and
coverage reports cascade, and then the users. `team`, `task`, and `meeting` rows block deleting their creator, so the
users have to go last. It never touches anything that isn't on this list.
