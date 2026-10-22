## PB-XX — <title>

Closes #<issue>

### What changed
<!-- 2–5 bullets. Link the task spec: docs/tasks/PB-XX.md -->

### Acceptance criteria
<!-- Copy the AC list from the task file and tick each one; name the test that proves it. -->
- [ ] AC1 — `tests/integration/…` “AC1: …”

### Screenshots (required for UI changes — these go into the progress report)
<!-- Drag images here: happy path, empty state, error state. -->

### Definition of Done
- [ ] Only files my task owns changed (no schema / contracts / shared files / package.json)
- [ ] `npm run check` and `npm run build` pass locally; CI green
- [ ] Integration tests for every service function and route; Cypress spec with `cy.checkPageA11y()`
- [ ] Coverage still ≥ 70%
- [ ] UI checked against `docs/contracts/ui-guidelines.md` (loading / empty / error / success states, keyboard only)
- [ ] Activity + notifications emitted as the task file requires
- [ ] `docs/tasks/PB-XX.md` Implementation notes updated
- [ ] `docs/ai-log/PB-XX.md` written (what AI produced, what I verified/changed)
- [ ] I can explain every file in this diff to my reviewer

### How to review / demo
<!-- Steps for the reviewer: which seed user, which page, what to click. -->

### AI assistance
<!-- Tool(s) used and a one-line summary; details in docs/ai-log/PB-XX.md -->
