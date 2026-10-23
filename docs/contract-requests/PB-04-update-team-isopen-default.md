# Contract request: `updateTeamInput` re-opens closed teams on every edit

Requested by: Dev Patel for PB-04 · Date: 2026-10-23

## What I need

`updateTeamInput` in `src/contracts/teams.ts` to leave `isOpen` **undefined** when the request doesn't send it.

## Why the current contract doesn't work

`updateTeamInput = createTeamInput.partial()`, and `createTeamInput.isOpen` is `z.boolean().default(true)`. In Zod 4 the
default still applies inside `.partial()`:

```ts
updateTeamInput.parse({ name: "Renamed" }); // → { name: "Renamed", isOpen: true }
```

So `PATCH /api/v1/teams/:id { name }` on a **closed** team would silently list it in course search again (and the
activity log would say "listed the team in course search"). `tests/unit/teams.test.ts` documents the current
behaviour.

## Proposed change (exact diff)

```diff
-export const updateTeamInput = createTeamInput.partial();
+export const updateTeamInput = createTeamInput.extend({ isOpen: z.boolean() }).partial();
```

## Who else is affected

Only PB-04 calls `updateTeamInput`. No DTO or schema change.

## Workaround I'm using meanwhile

`src/app/api/v1/teams/[teamId]/route.ts` (PATCH) reads the raw body and only passes `isOpen` to `updateTeam` when the body
contains it. `tests/integration/teams.test.ts` "PATCH /teams/:id … a rename keeps a closed team closed" covers it. After
the contract fix, the route can go back to `parseBody(req, updateTeamInput)` and the unit test that documents the quirk
should be flipped.
