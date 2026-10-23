# Contract request: E2E specs hit Better Auth's sign-in rate limit (429) — `smoke.cy.ts` fails after other specs

> **Status: resolved by #20** (`cy.login()` retries on 429; sidebar contrast fixed). `board.cy.ts` dropped its workaround in the PB-05 move-race follow-up.

Requested by: Krish Ruparel for PB-05 (also seen in PB-02) · Date: 2026-10-22

## What I need

A way for the Cypress suite to sign in as seed users without tripping Better Auth's production rate limit.

## Why the current contract doesn't work

The E2E job runs `npm run start` (production), where Better Auth limits `/sign-in*` and `/sign-up*` to **3 requests
per 10 s per IP** (`getDefaultSpecialRules()` in `better-auth/dist/api/rate-limiter`). `cy.login()` uses `cy.session`
without `cacheAcrossSpecs`, so **every spec signs in again**. `smoke.cy.ts` alone already uses all 3 (wrong password,
`varad`, `outsider`). Any spec that runs before it alphabetically and signs in (`activity`, `auth`, `availability`,
`board`, …) makes it fail with `429: Too Many Requests`:

```
smoke -- hides team content from non-members
> 429: Too Many Requests   (cy.request POST /api/auth/sign-in/email from cy.login("outsider"))
```

Cypress retries once, which sometimes hides it, so CI will be **flaky for everyone** as feature specs land.

## Proposed change (exact diff) — option A, recommended (no production impact)

`cypress/support/commands.ts`: reuse each seed user's session for the whole run.

```diff
 Cypress.Commands.add("login", (user: SeedUser = "varad") => {
-  cy.session(user, () => {
+  cy.session(
+    user,
+    () => {
       cy.request({ … })
         .its("status")
         .should("eq", 200);
-  });
+    },
+    { cacheAcrossSpecs: true },
+  );
 });
```

That brings the suite to about one API sign-in per seed user per run. Specs that sign in through the **UI** (smoke's
wrong-password test, `auth.cy.ts`) still count, so those should stay few, or option B is also needed.

## Option B (if A isn't enough)

`src/server/auth.ts`: raise only the sign-in rule, keeping brute-force protection in production:

```diff
   session: { … },
+  rateLimit: { customRules: { "/sign-in/email": { window: 10, max: 10 } } },
```

## Who else is affected

Every item with a Cypress spec (all of PB-02…PB-15), and CI for every PR.

## Workaround I'm using meanwhile

`cypress/e2e/auth.cy.ts` (PB-02) and `cypress/e2e/board.cy.ts` (PB-05) end with `after(() => cy.wait(10_000))` so
the rate-limit window passes before the next spec. That costs 10 s per spec and doesn't scale, so please fix this
before more specs land.
