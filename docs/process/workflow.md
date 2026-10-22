# Team workflow (Scrum, one-week sprints)

## Flow for one backlog item

1. **Issue.** Each PB item is a GitHub issue on the Projects board (labels `PB-XX`, `sprint-N`, `must|should|could`,
   owner assigned). Move it to *In Progress* when you start.
2. **Branch** from up-to-date `main`: `feat/PB-05-task-board` (fixes: `fix/PB-05-drag-keyboard`, contract changes:
   `contract/<slug>`).
3. **Build** with your agent following `docs/tasks/PB-XX.md`. Commit small and often:
   `feat(tasks): add move endpoint with midpoint positions (PB-05)` — Conventional Commits, item id at the end.
4. **Check locally:** `npm run check` and `npm run build`; run your Cypress spec.
5. **Open the PR** (`gh pr create --base main`), fill in the template, add screenshots, link `Closes #<issue>`.
6. **Review** by your review partner (`ownership.md`). They must be able to explain the code (DoD). Address comments
   with new commits; don't force-push after review starts.
7. **Merge** with *Squash and merge* once CI is green and approved. Delete the branch. Move the issue to *Done*.
8. **Demo** at the Saturday sprint review; the PO accepts or rejects against the acceptance criteria.

`main` is protected: PR required, 1 approval, CI (`quality`, `integration`, `e2e`) must pass, branch must be up to date.

## If you're blocked by a shared contract

Create `docs/contract-requests/PB-XX-<slug>.md` on your branch:

```md
# Contract request: <short title>
Requested by: <name> for PB-XX · Date: <date>
## What I need
<field / endpoint / component / dependency>
## Why the current contract doesn't work
## Proposed change (exact diff or signature)
## Who else is affected
## Workaround I'm using meanwhile
```

Tell the tech lead (Dev). He opens a `contract/<slug>` PR changing the shared files; once merged everyone rebases.
Don't change shared files on your feature branch.

## Merge conflicts

Feature folders don't overlap, so conflicts should only happen in docs. If `main` moved: `git fetch && git rebase origin/main`,
fix, `npm run check`, push with `--force-with-lease` (only before review starts) or merge `main` into your branch.

## AI-usage log (graded in the progress report §6.2)

Every PR adds `docs/ai-log/PB-XX.md`:

```md
# AI log — PB-XX <title>
| Date | Phase | Tool | Prompt / input (summary) | Output used | Human validation / correction |
|---|---|---|---|---|---|
| 2026-10-23 | Implementation | Claude Code | "Implement PB-05 per docs/tasks/PB-05.md" | services/tasks, routes, board UI | Reviewed diff; fixed position math bug found by my test AC4; rejected agent's attempt to edit schema |
```

Record at least: what you asked, what you kept, what you checked or changed, and anything you rejected. "Accepted
blindly" is not allowed by the course.

## Scrum events (log them in `docs/process/scrum-log.md` — evidence for report §2)

| Event | When | Length | Output |
|---|---|---|---|
| Sprint planning | Saturday after class (start of sprint) | 20 min | sprint goal, selected items, owners |
| Daily stand-up | written, in the team chat, by 10 pm | — | yesterday / today / blockers |
| Sprint review | Saturday after class (end of sprint) | 15 min | demo, PO accept/reject |
| Retrospective | right after review | 10 min | Start / Stop / Continue + one action item |
| Backlog refinement | during planning | — | re-estimates, priority changes |

The Scrum Master (Krish) updates the burndown (`docs/process/burndown.md`) and the risk register after each event.
