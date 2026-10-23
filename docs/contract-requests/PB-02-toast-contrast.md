# Contract request: success toasts fail color contrast (axe `color-contrast`, serious)

Requested by: Krish Ruparel for PB-02 · Date: 2026-10-22

## What I need

The shared `<Toaster>` in `src/app/layout.tsx` to render toasts with text that meets WCAG AA (4.5:1).

## Why the current contract doesn't work

`<Toaster position="top-right" richColors closeButton />` uses sonner's built-in rich colors. A success toast
("Profile saved") renders `#008a2e` text on `#ecfdf3`, which is **4.25:1**. axe reports it as a **serious**
`color-contrast` violation, so any Cypress spec that runs `cy.checkPageA11y()` while a success toast is on screen
fails (NFR-03 requires zero serious/critical violations). This affects every feature that toasts after a save
(tasks, meetings, resources, polls…), not just PB-02.

Found by `cypress/e2e/auth.cy.ts` on the profile page right after "Save profile".

## Proposed change (exact diff)

Map toasts to our own tokens (all pass 4.5:1 on their `-50` backgrounds) instead of sonner's palette:

```diff
-        <Toaster position="top-right" richColors closeButton />
+        <Toaster
+          position="top-right"
+          closeButton
+          toastOptions={{
+            classNames: {
+              success: "!border-success-100 !bg-success-50 !text-success-700",
+              error: "!border-danger-100 !bg-danger-50 !text-danger-700",
+              warning: "!border-warning-100 !bg-warning-50 !text-warning-700",
+            },
+          }}
+        />
```

The simplest alternative is to drop `richColors` (sonner's default toast is dark text on white), at the cost of
losing the color meaning from `ui-guidelines.md` §3.

## Who else is affected

Everyone whose UI calls `useApiAction().run(…, { success })` or `toast.*` — all feature items.

## Workaround I'm using meanwhile

`cypress/e2e/auth.cy.ts` waits for the toast to disappear before calling `cy.checkPageA11y()`. Pages are checked
without a toast on screen; the toast itself stays below AA until this is fixed.
