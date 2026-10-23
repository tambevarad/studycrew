# Scrum log (evidence for progress report §2)

Add an entry after every event. Keep it short and factual.

## 2026-10-22 (Thu) — Catch-up planning (replaces Sprint 0–3 planning)

- Present: Varad (+ async to team chat)
- Situation: development not started; progress report due Sat Oct 24.
- Decision: build a shared-contract foundation today so all four members can build Sprint 1–3 items in parallel on Oct 23
  with their own AI coding agents; re-baseline plan in `sprint-plan.md`.
- Sprint goal (Oct 22–24): PB-01…PB-10 merged and demoable on staging; progress report submitted.
- Action items: Varad — foundation PR + repo + issues; Dev — review/merge foundation, staging, branch protection;
  everyone — set up locally and start their first item.

## 2026-10-22 (Thu, night) — Foundation merged without review; working order; reassignment

- PR #18 (foundation, part of PB-01) merged by Varad with the admin override **without the required approval**:
  Dev (tech lead, requested reviewer) was unavailable and Krish needed `main` to start. CI was green (`quality`,
  `integration`, `e2e`). Mitigation: Dev does a post-merge review (action item on issue #1); problems become
  `contract/*` fix PRs.
- Branch protection on `main` enabled (PR + 1 approval, code-owner review for shared files, 3 required checks,
  squash-only). The admin override stays available for emergencies and must be logged here.
- Team availability over the catch-up is **sequential**: Varad → Krish → Dev → Devarsh. The shared contracts still
  let each person build without waiting on others; only start times differ.
- **Reassignment (PO decision):** PB-05 Task board → Krish, PB-07 Resources → Varad, so Devarsh (last in order) can
  focus on PB-10, the graded AI feature. Change from proposal §8 / A.3; to be reported in progress report §1 and §9.
- Action items: Krish starts PB-02 → PB-05 → PB-03 → PB-08 (Krish); Dev post-merge review of #18, staging, PB-04 (Dev);
  Varad PB-09 → PB-07 → PB-06 + progress report (Varad); Devarsh PB-10 (Devarsh).

## 2026-10-22 (Thu, 7 pm) → 2026-10-23 (Fri, 1 am) — Build, review, and merge of PB-01…PB-10 (from GitHub history)

- **Outcome:** all 10 committed items (73 pts) merged to `main`; staging live at https://studycrew-staging.vercel.app;
  issue #1 (PB-01) closed Fri Oct 23. Times below are CDT, taken from PR merge times.
- **Working order in practice:** planned as sequential turns (Varad → Krish → Dev → Devarsh), but turns overlapped:
  Krish's first commit came at 8:12 pm while Varad's items were in progress; Dev and Devarsh started around 10 pm.
- **Reviews (every feature PR had an approving review before merge):** Krish reviewed Varad's #21, #22, #24 (requested
  changes on #24: CI hydration error, dialog naming, toast flake); Dev reviewed Krish's #23, #25, #26, #27; Devarsh
  reviewed Dev's #33 (changes requested first) and Dev's contract PRs #28, #29; Varad reviewed Devarsh's #34
  (changes requested: skipped requirements inflated the score) and Dev's #28, #29 and #39.
- **Review-pair deviation:** Varad reviewed Krish's follow-up #32 in place of Dev (unavailable); recorded in the review.
- **Merged before follow-ups landed:** #21 and #22 were merged right after approval, before the author's review fixes
  were pushed. The fixes went in as #30 and #31. Lesson: merge only when the approval is on the PR's latest commit.
- **Foundation bugs found by E2E** and fixed in shared-file PRs: sign-in rate limit in Cypress (#20, #37), sidebar and
  toast contrast (#20, #29), dialog accessible names (worked around in features; contract request filed).
- **Post-merge review of #18** done by Dev (issue #1 comment, Thu 9:18 pm).
- **Closed without merging:** #36 (a speculative board refresh fix); the real cause of the board flake (reload before
  the save finished) was fixed in #32.
- **Stand-ups:** no separate stand-up meeting was held; coordination happened in PR reviews and the team chat _(Krish to
  confirm or add the chat stand-up notes)_.
- **Action items:** Varad, progress report (due Sat Oct 24); everyone, hold the sprint review + retrospective after
  class on Sat Oct 24 and log it here; each member, record actual hours in their `docs/ai-log/PB-XX.md`.

<!-- Template:
## YYYY-MM-DD — Sprint N planning | review | retrospective | stand-up summary
- Present:
- Sprint goal / demo / outcome:
- Start / Stop / Continue:
- Action items (owner):
-->
