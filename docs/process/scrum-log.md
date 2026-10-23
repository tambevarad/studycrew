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

<!-- Template:
## YYYY-MM-DD — Sprint N planning | review | retrospective | stand-up summary
- Present:
- Sprint goal / demo / outcome:
- Start / Stop / Continue:
- Action items (owner):
-->
