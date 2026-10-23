# Contract request: active team link in the sidebar fails color contrast (axe `color-contrast`, serious)

> **Status: resolved by #20** (`cy.login()` retries on 429; sidebar contrast fixed). `board.cy.ts` dropped its workaround in the PB-05 move-race follow-up.

Requested by: Krish Ruparel for PB-05 · Date: 2026-10-22

## What I need

The course code in the **active** team link of `src/components/app-shell/sidebar.tsx` to meet WCAG AA (4.5:1).

## Why the current contract doesn't work

On any page under `/teams/[teamId]/…` the current team's link is highlighted with `bg-brand-50`, and its course code
uses `text-xs text-slate-500`: `#62748e` on `#eef2ff` = **4.26:1**. axe reports a **serious** `color-contrast`
violation, so `cy.checkPageA11y()` fails on **every team tab** (board, calendar, resources, coverage, polls, …).
The smoke spec doesn't catch it because it only checks `/` and `/dashboard`.

Found by `cypress/e2e/board.cy.ts`.

## Proposed change (exact diff)

```diff
-                    <span className="ml-auto text-xs text-slate-500">{t.courseCode}</span>
+                    <span className={cn("ml-auto text-xs", active ? "text-brand-700" : "text-slate-500")}>{t.courseCode}</span>
```

(`text-brand-700` on `bg-brand-50` already passes for the team name next to it. `text-slate-600` would also pass.)

## Who else is affected

Everyone with a team-tab page and a Cypress spec: PB-04 members, PB-06, PB-07, PB-09, PB-10, PB-12, PB-13, PB-14.

## Workaround I'm using meanwhile

`cypress/e2e/board.cy.ts` runs axe with the sidebar (`aside`) excluded and the same serious/critical filter as
`cy.checkPageA11y()`. The board content itself is fully checked. Switch back to `cy.checkPageA11y()` once this lands.
