# UI guidelines (graded — progress report §5.1, NFR-03, NFR-04)

These turn the course's *User Interface Design Principles* lecture into concrete rules. Follow them on every screen so
the app feels like one product, and so the report can cite them. Use only the components in `src/components/ui/`.

## 1. Principles → what we do

| Lecture principle | Rule in StudyCrew |
|---|---|
| **User familiarity** — user terms, not system terms | Say "team", "task", "meeting", "notes and links". Never show ids, enum names (`IN_PROGRESS`), or HTTP codes. Use `TASK_STATUS_LABELS`, `WORK_TYPE_LABELS`. |
| **Consistency** | Same layout on every page: `PageHeader` (title, one-line description, primary action on the right) → content. Primary action is always a `primary` Button; destructive is `danger`. Dates via `src/lib/dates.ts`. |
| **Minimal surprise** | Similar things behave alike: every list has filters at the top, every create opens a `Dialog`, every row click opens details. Links that leave the app open in a new tab and say so (`aria-label="… (opens in new tab)"`). |
| **Recoverability** | Every delete uses `ConfirmDialog` naming the item ("Delete “Draft slides”? This can't be undone."). Prefer reversible actions (moving a card back, un-voting before close). Forms keep input on error. |
| **User guidance** | Every empty list uses `EmptyState` with what belongs there and the next action. Fields have hints for formats ("Course code, like CSE 6324"). Explain AI limits right on the Coverage page. |
| **User diversity** | Keyboard works everywhere (drag-and-drop must have a keyboard/menu alternative). Text ≥ 14px, contrast ≥ 4.5:1 (our tokens pass). Don't rely on color alone — pair it with text or an icon. |

## 2. Golden rules

**Place the user in control.** Long operations (AI check) show progress and can be left; nothing auto-submits.
Hide internals: no stack traces, no raw JSON.

**Reduce memory load.** Show the current team and section (header + tabs). Use sensible defaults (status To Do,
priority Medium, 60-minute meetings, viewer's own timezone). Use progressive disclosure: cards show title, assignees, due
date, priority; details open in a dialog.

**Make the interface consistent.** Same words for the same thing across pages; same placement of actions; same
color meanings (below).

## 3. Color (limit 4–5, consistent meaning)

| Token | Means | Use for |
|---|---|---|
| `brand` (indigo) | action, selection | primary buttons, links, active tab, focus ring |
| `success` (green) | good / done | Done tasks, **Covered** requirements, members available, RSVP yes |
| `warning` (amber) | attention | due within 24 h, **Partial**, Review column, RSVP maybe |
| `danger` (red) | problem | errors, overdue, **Missing**, destructive buttons, RSVP no |
| `neutral` (slate) | everything else | text, borders, low priority |

Red always means a problem — never use it for decoration. Use `Badge tone=…` and `Alert tone=…`.

## 4. Text vs graphics

Use **graphics** when relationships or trends matter: the availability heatmap (darker = more people free), dashboard
completion and workload charts (Recharts), coverage score ring. Use **text** when precision matters: exact meeting
times, due dates, evidence quotes, counts next to every chart (charts always have a text equivalent for screen readers).

## 5. Messages

Polite, concise, specific, constructive — the lecture's "R. MacDonald is not registered…" example.

| Bad | Good |
|---|---|
| "Error 403" | "Only a team leader can remove members." |
| "Invalid input" | "End time must be after the start and within 8 hours." |
| "Request failed" | "The AI service didn't answer within 30 seconds. Your text wasn't saved by the provider — try again in a minute." |

Server messages come from `errors.*()` in services; the UI shows them via `useApiAction` toasts. Field errors appear
under the field (`FormField error=…`). Success = a short toast in past tense ("Task added").

## 6. Every screen has four states

1. **Loading** — `loading.tsx` or a skeleton; buttons show `loading` while pending.
2. **Empty** — `EmptyState` with a next action.
3. **Error** — friendly message + retry; never a blank page.
4. **Success** — the data, plus toast feedback after actions.

## 7. Accessibility checklist (NFR-03: zero serious/critical axe issues, Lighthouse ≥ 90)

- Every input has a visible label (`FormField`). Icon-only buttons have `aria-label`.
- One `h1` per page. Top-level pages use `PageHeader` (h1). Team tabs use `SectionHeader` (h2) because the team layout already renders the team name as the h1.
- Dialogs use `Dialog`/`ConfirmDialog` (native `<dialog>`: focus trap + Esc).
- Drag-and-drop (board, availability grid) has a keyboard path: arrow keys/space on the grid; a "Move to…" menu on cards.
- Status is never color-only (badge text, icons, `aria-label`).
- Your Cypress spec calls `cy.checkPageA11y()` on each page you build.

## 8. Usability evaluation (for the report and NFR-04)

Sprint 5 runs a moderated test with ≥ 5 students on the core flow (create team → invite → schedule meeting → assign
task) plus the SUS questionnaire (`docs/process/usability-test.md`, PB-17). Before that, each PR author does a quick
heuristic pass against sections 1–7 and ticks it in the PR template.
