# Re-baselined sprint plan (honest version for the progress report)

## What actually happened vs the proposal

The proposal (submitted Sep 26) planned Sprint 0 from Sep 27 and Sprints 1–3 from Oct 4 to Oct 24. **Development did
not start until Thursday Oct 22**, the week the progress report is due. Sprints 0–2 did not run. This plan
re-baselines the remaining work; the progress report's §3 (planned vs actual) reports the slip, the cause, and this
corrective action.

**Corrective action:** compress Sprints 0–3 into a two-day catch-up (Oct 22–24) made possible by (1) a shared-contract
foundation that removes dependencies between members, and (2) each member running an AI coding agent on their own
items in parallel, with human review of every PR. Sprints 4 and 5 keep their original dates.

## Catch-up: Oct 22 (Thu) – Oct 24 (Sat), progress report due Oct 24

| When | Work | Who |
|---|---|---|
| Thu Oct 22 | Foundation + contracts PR (schema, contracts, server core, UI kit, shell, test harness, CI, task specs) | Varad + Claude Code; Dev reviews |
| Thu Oct 22 night | Repo, Projects board, issues PB-01…PB-17, branch protection | Varad (repo admin), Dev |
| Thu night → Sat | Build one branch per item, **in turn**: Varad → Krish → Dev → Devarsh (team availability) | everyone |
| Fri Oct 23 night | PRs open, cross-reviews, merges | review pairs |
| Sat Oct 24 | Staging smoke test, screenshots, progress report, sprint review + retro after class | everyone; Varad leads the report |

| Item | Owner | Points | Target |
|---|---|---|---|
| PB-01 rest: Neon + Vercel staging, branch protection, CI green | Dev | (8 incl. foundation) | Fri |
| PB-02 Accounts and profiles | Krish | 5 | Fri |
| PB-03 Availability grid | Krish | 5 | Fri |
| PB-04 Teams, invites, join requests | Dev | 8 | Fri |
| PB-05 Task board | Krish (from Devarsh) | 8 | Fri |
| PB-06 Calendar and meeting finder | Varad | 13 | Fri–Sat |
| PB-07 Notes, links, file references | Varad (from Devarsh) | 5 | Fri |
| PB-08 In-app notifications | Krish | 5 | Fri–Sat |
| PB-09 Activity history | Varad | 3 | Fri |
| PB-10 AI Coverage Check (Dev pairs on review) | Devarsh | 13 | Fri–Sat |
| **Total by Oct 24** | | **73** | |

**Reassignment (Oct 22):** because members are available one after another and Devarsh is last, PB-05 moved to
Krish and PB-07 to Varad. Load by Oct 24: Varad 21 pts (PB-09, PB-07, PB-06), Krish 23 (PB-02, PB-05, PB-03, PB-08),
Dev 8 + staging + reviews (PB-04), Devarsh 13 (PB-10).

If something won't make Oct 24, it moves to Sprint 4 **in this order**: PB-07, then PB-08 polish, then PB-06 heatmap
(keep the finder). The report states exactly what was done and what moved.

## Sprint 4: Oct 25 – Oct 31 (unchanged dates)

PB-11 Varad (3) · PB-12 Krish (5) · PB-13 Varad (5) · PB-14 Dev (5) · PB-15 Devarsh (5) + anything carried over. 23 pts.

## Sprint 5: Nov 1 – Nov 7, final submission Nov 7 (unchanged)

PB-16 Devarsh (5) · PB-17 Dev + Krish (8) · final report, user guide, developer docs (Varad). 13 pts.
Presentation prep Nov 8–13; presentations Nov 14–28.

## Velocity assumption check

Proposal assumed ~1 person-hour per point with AI assistance. The catch-up is the first real measurement: each member
logs actual hours per item in their AI log so §3 and the Sprint 4 plan use measured velocity, not the assumption
(risk R-01).
