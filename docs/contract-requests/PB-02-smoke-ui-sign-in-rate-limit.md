# Contract request: `smoke.cy.ts` "rejects a wrong password" flakes on the sign-in rate limit (429)

Requested by: Krish Ruparel for PB-02 · Date: 2026-10-22

## What I need

`cypress/e2e/smoke.cy.ts` ("rejects a wrong password with a helpful message") to cope with Better Auth's sign-in rate
limit, like `cy.login()` already does since #20.

## Why the current contract doesn't work

Better Auth allows **3 requests to `/sign-in/email` per 10 s per IP** in production builds (the E2E job runs
`npm run start`). #20 made `cy.login()` wait for `X-Retry-After` and retry, but this smoke test signs in **through the
form**, so it gets no retry. When the window still holds earlier sign-ins, the server answers 429.

Since PB-02 (#23), the form shows the real reason for a 429 ("Too many attempts. Try again in N seconds."). The old
form showed "That email and password don't match" for **every** error, which hid the 429. Now the test's
`cy.contains("don't match")` fails whenever the window is busy, and Cypress's single retry usually rescues it 10 s later.

Seen in CI: run 39891343726 (#24, `491cfae`): `(Attempt 1 of 2) rejects a wrong password with a helpful message`.
Locally, `auth.cy.ts` AC3 failed the same way (401 for the wrong password, then 429 for the right one) until this PR.

## Proposed change (exact diff)

The same pattern `auth.cy.ts` now uses: submit, and if the response is 429, wait the `X-Retry-After` it sent and
submit again.

```diff
   it("rejects a wrong password with a helpful message", () => {
+    cy.intercept("POST", "/api/auth/sign-in/email").as("signIn");
     cy.visit("/sign-in");
     cy.get("input[name=email]").type("varad@studycrew.test");
     cy.get("input[name=password]").type("wrong-password");
-    cy.contains("button", "Sign in").click();
+    const submit = (attempt = 1): void => {
+      cy.contains("button", "Sign in").click();
+      cy.wait("@signIn").then(({ response }) => {
+        if (response?.statusCode === 429 && attempt < 4) {
+          cy.wait((Number(response.headers["x-retry-after"]) || 10) * 1000 + 250);
+          submit(attempt + 1);
+        }
+      });
+    };
+    submit();
     cy.contains("don't match").should("be.visible");
   });
```

If more specs need UI sign-in, the same function could become a shared command in `cypress/support/commands.ts`
(e.g. `cy.submitAuthForm()`).

## Who else is affected

CI for every PR (the smoke spec runs last, after every spec that signs in).

## Workaround I'm using meanwhile

None for `smoke.cy.ts` (shared file). `auth.cy.ts` uses this pattern for its own UI sign-ins and sign-ups (this PR).
