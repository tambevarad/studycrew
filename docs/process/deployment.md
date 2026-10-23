# Deployment (PB-01 · NFR-05)

StudyCrew runs as **one Next.js app on Vercel** backed by **one Neon Postgres 16 database** (ADR 1). For this course,
Vercel's *Production* environment is our **staging**: every merge to `main` deploys there. Owner: Dev (tech lead).

## URLs

| What | URL |
|---|---|
| Staging app | https://studycrew-staging.vercel.app |
| Health check | https://studycrew-staging.vercel.app/api/health → `200 {"status":"ok","db":"ok",…}`, or `503 {"status":"degraded"}` if the DB is down |
| Uptime status page | https://stats.uptimerobot.com/HoIv0SBQ5d (UptimeRobot, public) |
| Vercel project | https://vercel.com/devjpatells-projects/studycrew-staging (Dev's Hobby account) |
| Neon project | https://console.neon.tech/app/projects/mute-mud-22473212 (Dev's account): project `studycrew`, branch `production`, database `studycrew`, Postgres 16, AWS US East 1 |

## How a deploy happens

The repo lives on Varad's personal GitHub account and the Vercel project on Dev's Hobby account, so **Vercel's Git
integration can't link the repo** ("To link a GitHub repository, you need to install the GitHub integration first").
Hobby would also block deploys of commits written by anyone but the account owner. So we deploy with the Vercel CLI:

1. A PR merges to `main` (branch protection: 1 approval + `quality`, `integration`, `e2e`).
2. `.github/workflows/deploy.yml` runs `vercel deploy --prod`, which uploads the commit and **builds on Vercel**. The
   database URLs stay in Vercel's settings and never reach GitHub.
3. On Vercel, `npm ci` installs (`postinstall` runs `prisma generate`), then `vercel.json`'s build command runs:
   ```sh
   DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy && next build
   ```
   - Migrations run over the **direct** connection. They take a session-level advisory lock, which Neon's PgBouncer
     pooler doesn't hold reliably. Prisma 7's `prisma.config.ts` has no `directUrl`, so the build overrides
     `DATABASE_URL` for this one command only.
   - The running app uses the **pooled** `DATABASE_URL`.
   - If a migration fails, the build fails and **the previous deployment keeps serving**.
4. The workflow then polls `/api/health` until it returns 200, or fails the job.

Until the repo secrets below exist, the workflow skips with a notice instead of failing. Run it again from **Actions →
Deploy staging → Run workflow**.

**Manual deploy** (from a clean checkout, never a folder with `.env` files). Run `npx vercel@latest link --project
studycrew-staging` once in your normal checkout. Then copy its `.vercel/project.json` into the clean folder, rather than
running `link` there, because `link` also writes a token into `.env.local`:
```sh
git worktree add --detach ../studycrew-deploy origin/main
mkdir -p ../studycrew-deploy/.vercel && cp .vercel/project.json ../studycrew-deploy/.vercel/
cd ../studycrew-deploy && npx vercel@latest deploy --prod
```

**No preview deployments.** Without the Git integration, PRs don't get Vercel previews. Reviewers run the app locally
(`npm run build && npm run start`), and CI's `e2e` job exercises the production build. Better Auth also only trusts
`BETTER_AUTH_URL`'s origin, so sign-in wouldn't work on preview URLs anyway.

## Environment variables (names only; values live in Vercel and GitHub, never in the repo)

**Vercel** → https://vercel.com/devjpatells-projects/studycrew-staging/settings/environment-variables (Production):

| Name | Used by | Value comes from |
|---|---|---|
| `DATABASE_URL` | app at runtime (Prisma pg adapter) | Neon → Connect → database `studycrew`, **pooling on** (host contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | `prisma migrate deploy` during the build | Neon → Connect → **pooling off** |
| `BETTER_AUTH_SECRET` | session signing | 32 random bytes, base64. Never reuse the local one |
| `BETTER_AUTH_URL` | Better Auth origin check + callbacks | `https://studycrew-staging.vercel.app` (exactly, no trailing slash) |
| `AI_PROVIDER` | PB-10 Coverage Check | `mock` for now; `openai` + `OPENAI_API_KEY` when PB-10 goes live |

Changing a variable only affects **new** deployments, so redeploy afterwards. Rotating `BETTER_AUTH_SECRET` signs
everyone out.

**GitHub** → https://github.com/tambevarad/studycrew/settings/secrets/actions (only the repo owner can add these):

| Secret | Where Dev finds it |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/settings/tokens → Create (scope: Dev's Hobby team; give it an expiry) |
| `VERCEL_ORG_ID` | `orgId` in `.vercel/project.json` of a linked checkout (the **team** ID of "devjpatell's projects", starts with `team_`) |
| `VERCEL_PROJECT_ID` | `projectId` in the same file (= Vercel project → Settings → General → **Project ID**, starts with `prj_`) |

Dev sends these to Varad **privately** (not team chat, not an AI tool), and Varad pastes them into GitHub.

## Seeding staging (once)

`prisma/seed.ts` **deletes all app data** and then recreates the demo users and teams. Run it **once**, after the first
successful deploy (which applied the migrations), and never again once real usage starts. Use the Neon **direct** URL.
`dotenv` doesn't override a variable that's already set, so your local `.env` won't redirect it.

Git Bash (the URL isn't shown on screen or saved):
```sh
read -rs NEON_DIRECT && export DATABASE_URL="$NEON_DIRECT"
npm run db:seed          # prints "Seeded 6 users, 3 teams…"
unset DATABASE_URL NEON_DIRECT
```

PowerShell:
```powershell
$env:DATABASE_URL = Read-Host "Paste the Neon direct URL"
npm run db:seed
Remove-Item Env:DATABASE_URL
```

Never commit the URL or paste it into chat. The seed password is public in the repo (`prisma/seed.ts`), so staging holds
**test data only**: never store anything real there.

## Rollback

- **App:** Vercel → https://vercel.com/devjpatells-projects/studycrew-staging/deployments → pick the last good deployment
  → **⋯ → Promote to Production** (Instant Rollback). It switches within seconds, with no rebuild.
- **Database:** migrations are not rolled back automatically. With the schema frozen (ADR 3) this should not come up. If a
  migration must be undone, merge a new forward migration through a `contract/*` PR.

## Rotating secrets

- **Database password:** Neon → Roles → `studycrew_owner` → **Reset password**. Then copy both connection strings again
  into Vercel's `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, and redeploy.
- **Auth secret:** generate a new value (`node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"`),
  update `BETTER_AUTH_SECRET` in Vercel, and redeploy. Everyone is signed out.
- **Vercel token:** revoke it at https://vercel.com/account/settings/tokens, create a new one, and have Varad update
  `VERCEL_TOKEN`.

## Uptime monitoring (NFR-05)

UptimeRobot (free) HTTP(s) monitor on https://studycrew-staging.vercel.app/api/health every **5 minutes**, alerting Dev
by email when the response isn't 2xx (a `503` means the database is unreachable). The public status page is in the URLs
table.

## Secrets

Never commit `.env*` files (they're git-ignored), `.vercel/` (git-ignored), connection strings, or tokens. Never paste
them into PRs, issues, chat, or AI tools.
