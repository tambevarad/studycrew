# Contract request: keep the destination when a signed-out visitor is sent to sign-in (D-01)

Requested by: Dev Patel for PB-04 · Date: 2026-11-03 · **Status: implemented in #48 (contract PR)**

## What I need

When a signed-out visitor opens a signed-in page, especially an invite link `/join/<code>`, they should be sent to
`/sign-in?next=<that page>`, so that after signing in or signing up they come back to it.

## Why the current contract doesn't work

- `requirePageUser()` (`src/server/session.ts`) redirects to bare `/sign-in`.
- The shared `(app)` layout calls it **before the page renders**. Checked: a temporary redirect *with* `?next=` inside
  the join page never fires; the layout's bare redirect wins, 3/3.
- A layout can't see the URL ("Layouts do not … access pathname", Next 16 docs), so neither `session.ts` nor the layout
  can add `next`, and nothing in PB-04's own files can fix it.

Result (D-01): signed out, `GET /join/<code>` → `307 /sign-in`. After sign-up the student lands on `/profile?welcome=1`
and isn't on the team.

## Proposed change (done in #48)

- New `src/proxy.ts` (Next 16 "Proxy", formerly middleware): for the `(app)` folders only, no session cookie →
  `307 /sign-in?next=<path+query>`. This is optimistic. The real check stays in `requirePageUser()` and the services.
- New `src/lib/safe-next.ts`: `safeNextPath()` accepts only same-origin relative paths (rejects `//`, `\`, schemes,
  control characters that browsers strip, and dot segments that normalize to `//`). `signInPathFor()` builds the redirect.
- Unit tests: `tests/unit/safe-next.test.ts`, `tests/unit/proxy.test.ts`. The latter fails if a new `(app)` folder isn't
  in the proxy matcher.

## Who else is affected

- Everyone, positively: notification links (`/teams/<id>/board?task=…`) and bookmarks now survive sign-in too.
- **PB-02 (Krish):** `src/components/features/auth/validation.ts` `safeNextPath` accepts `"/\t/evil.com"` and
  `"/\n/evil.com"`, which browsers resolve to evil.com (an open redirect). Please switch `auth-form.tsx` to
  `import { safeNextPath } from "@/lib/safe-next"` (one line), or make the PB-02 helper call it.

## Workaround meanwhile

None needed after #48 merges. The sign-in/up form already follows `?next=` and keeps it when you switch between the two
forms. Remaining edge: someone with an *expired* session cookie passes the proxy and gets the layout's bare redirect.
That's rare, and they still sign in fine.
