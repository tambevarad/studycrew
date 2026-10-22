# Starting your agent

Each of us runs our **own** Claude Code (or Codex) session, signed in to our **own** GitHub account, on our own
items. That way commits, PRs, and reviews really are ours — the progress report's contribution table (§9) is checked
against repo history.

## One-time setup (≈ 10 minutes)

1. Accept the GitHub invite to the repo. Install Node 22+ and Docker Desktop, and run `gh auth login`.
2. `git clone <repo-url> && cd studycrew && npm ci`
3. `cp .env.example .env && cp .env.example .env.local`, then set `BETTER_AUTH_SECRET` in both
   (`openssl rand -base64 32`).
4. `npm run db:up && npm run db:migrate && npm run db:test:migrate && npm run db:seed`
5. `npm run check` should pass. `npm run dev` → sign in as `<yourname>@studycrew.test` (password is in
   `prisma/seed.ts`).

## The prompt to paste (edit the bracketed parts)

```text
I'm [Krish Ruparel (M2)] on the StudyCrew team. My backlog items for this sprint are [PB-02, PB-03, PB-08], in that order.

1. Read CLAUDE.md, then docs/tasks/[PB-02].md, then the contracts and docs it points to. Follow the hard rules: only edit
   files my task owns, no schema/contract/package changes, use teamRoute/logActivity/notify, write the required tests.
2. Create branch feat/[PB-02]-[slug] from origin/main. Implement the item completely: service, routes, UI, tests.
   Meet every acceptance criterion and the UI guidelines.
3. Run npm run check and npm run build until both pass. Run my Cypress spec against a production build if possible.
4. Fill in the "Implementation notes" section of my task file and write docs/ai-log/[PB-02].md with an honest log of
   what you generated and what I need to verify.
5. Commit in small Conventional Commits ending with ([PB-02]). Push and open a PR to main with the template filled in.
   Then give me: a summary, how to demo it, what to screenshot for the progress report, and anything I must check
   by hand before asking for review.
6. Then continue with the next item on a NEW branch from origin/main.

If a shared contract blocks you, stop, write docs/contract-requests/[PB-XX]-<slug>.md, and tell me.
```

## Who does what by Sat Oct 24

| Person | Items (in order) | Review partner |
|---|---|---|
| Varad (M1) | PB-09 → PB-06 → progress report | Krish |
| Krish (M2) | PB-02 → PB-03 → PB-08 | Dev |
| Dev (M3) | PB-01 (staging + branch protection) → PB-04 | Devarsh |
| Devarsh (M4) | PB-05 → PB-10 → PB-07 | Varad |

## Before you ask for review — check by hand (the reviewer will ask you to explain)

- Read the whole diff. Can you explain every file? If not, ask the agent to walk you through it.
- Click through the feature in the browser: happy path, an empty state, an error (bad input), keyboard only.
- Take the screenshots the task file's "Demo" section lists and attach them to the PR.
- Correct the AI log if the agent over-claimed anything.
