# Contract request: unique dialog ids; neutral home for pure date helpers
Requested by: Varad (PB-06) · Date: 2026-10-23 · Found by: Krish's review of #24

## 1. `Dialog` uses a fixed `id="dialog-title"`
### What I need
`src/components/ui/dialog.tsx` should generate the heading id with `useId()` and use it for `aria-labelledby`.
### Why the current contract doesn't work
Two dialogs mounted at once (even if one is closed) share `id="dialog-title"`, so the open dialog's accessible name
can resolve to the other one ("Schedule a meeting" announced as "Find a time"). axe doesn't flag it.
### Proposed change
```tsx
const titleId = useId();
<dialog aria-labelledby={titleId} …><h2 id={titleId}>{title}</h2>
```
### Who else is affected
Everyone using `Dialog` / `ConfirmDialog` (PB-05, PB-07, PB-10, …). No API change.
### Workaround I'm using meanwhile
PB-06 only mounts `FindTimeDialog` while it's open (#24).

## 2. Pure date helpers live under a UI folder
### What I need
Move `src/components/features/meetings/calendar-dates.ts` and `format.ts` (pure, no React) to `src/lib/` so server code
doesn't import from `components/`.
### Why
The meeting-finder service imports them (works, but the layering is backwards). `src/lib` is frozen, hence this request.
### Who else is affected
Only PB-06 imports them today. PB-12 (dashboard: upcoming meetings) will probably want `format.ts` too.
### Workaround meanwhile
Server imports from `@/components/features/meetings/*`. The files are pure and safe to import anywhere.
