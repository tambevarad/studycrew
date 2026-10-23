# Deployment (PB-01 · NFR-05)

StudyCrew runs as **one Next.js app on Vercel** backed by **one Neon Postgres 16 database** (ADR 1). For this course,
Vercel's *Production* environment is our **staging**: every merge to `main` deploys there. Owner: Dev (tech lead).

## URLs

| What | URL |
|---|---|
| Staging app | _(fill in after setup: `https://<project>.vercel.app`)_ |
| Health check | _(staging URL)_`/api/health` → `200 {"status":"ok","db":"ok",…}`, or `503 {"status":"degraded"}` if the DB is down |
| Uptime status page | _(fill in: UptimeRobot public status page)_ |
| Vercel project | _(fill in: `https://vercel.com/<account>/<project>`)_ (Dev's account) |
| Neon project | Neon console → project `studycrew` (Dev's account), Postgres 16, region `aws-us-east-1` |

## Environments

| Environment | Trigger | Database | Notes |
|---|---|---|---|
| Local | `npm run dev` | Docker Postgres (`docker-compose.yml`) | See `CLAUDE.md` → Commands |
| CI | every PR + push to `main` | Postgres service container | `.github/workflows/ci.yml` (`quality`, `integration`, `e2e`) |
| Preview | every PR (Vercel) | the staging Neon database | **Sign-in does not work on preview URLs** (see below) |
| Staging (Vercel *Production*) | merge to `main` | Neon `studycrew` | What the TA and the uptime monitor see |

## Environment variables (names only — values live in Vercel, never in the repo)

Set in Vercel → Project → Settings → Environment Variables, for **Production** and **Preview**.

| Name | Used by | Value comes from |
|---|---|---|
| `DATABASE_URL` | app at runtime (Prisma pg adapter) | Neon **pooled** connection string (host contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | `prisma migrate deploy` during the build | Neon **direct** connection string (no `-pooler`) |
| `BETTER_AUTH_SECRET` | Better Auth session signing | a new value from `openssl rand -base64 32` (not the local one) |
| `BETTER_AUTH_URL` | Better Auth origin check + callback URLs | the staging URL, exactly, e.g. `https://<project>.vercel.app` (no trailing slash) |
| `AI_PROVIDER` | PB-10 Coverage Check | `mock` until PB-10 lands; then `openai` / `gemini` / `claude` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | PB-10 when `AI_PROVIDER=openai` | added by the PB-10 owner when needed |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `ANTHROPIC_API_KEY` | PB-10 alternatives | only if that provider is chosen |

Changing an env var only affects **new** deployments: redeploy after editing. Rotating `BETTER_AUTH_SECRET` signs
everyone out.

## How a deploy works and how migrations run

`vercel.json` sets the build command:

```sh
DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy && next build
```

1. `npm ci` installs dependencies; `postinstall` runs `prisma generate`.
2. `prisma migrate deploy` applies any pending migrations in `prisma/migrations/` to Neon. It uses the **direct**
   connection, because migrations take a session-level advisory lock that a PgBouncer (pooled) connection doesn't hold
   reliably. Prisma 7's `prisma.config.ts` has no `directUrl`, so the build overrides `DATABASE_URL` for this one command
   only. If `DATABASE_URL_UNPOOLED` isn't set, it falls back to `DATABASE_URL`.
3. `next build`. The running app keeps using the pooled `DATABASE_URL`.

If a migration fails, the build fails and the **previous deployment keeps serving**. Nothing half-deploys.

**Previews share the staging database.** Because the schema is frozen (ADR 3), feature PRs have no migrations, so
previews don't change staging. A `contract/*` PR that adds a migration **will migrate staging when its preview builds**,
so the tech lead merges those promptly or turns off previews for that PR.

**Previews can't sign in.** Better Auth rejects requests from any origin other than `BETTER_AUTH_URL` (403). Use
previews to check pages and the build. Test signed-in flows locally or on staging after merge.

## Seeding staging (once)

`prisma/seed.ts` **deletes all app data** and then recreates the demo users and teams. Run it **once**, right after the
first successful deploy, and never again once real usage starts:

In Git Bash, from the repo folder. `read -rs` waits silently for you to paste the Neon **direct** URL, so it never shows on
screen, in shell history, or in a file:

```sh
read -rs NEON_DIRECT && export DATABASE_URL="$NEON_DIRECT"
npm run db:seed          # prints "Seeded 6 users, 3 teams…"
unset DATABASE_URL NEON_DIRECT
```

`dotenv` doesn't override variables that are already set, so your local `.env` doesn't redirect the seed. The migrations
must already be applied (the first Vercel build does that). Never commit the URL or paste it into chat. The seed password
is public in the repo (`prisma/seed.ts`), so staging holds **test data only**: never store anything real there.

## Rollback

- **App:** Vercel → Project → Deployments → pick the last good deployment → **⋯ → Promote to Production**
  (Instant Rollback). Staging switches over within seconds, with no rebuild.
- **Database:** migrations are not rolled back automatically. With the schema frozen this should not come up. If a
  migration must be undone, merge a new forward migration through a `contract/*` PR, then deploy.

## Uptime monitoring (NFR-05)

UptimeRobot (free) HTTP(s) monitor on the staging `/api/health` URL every **5 minutes**. It alerts by email to Dev when
the response isn't 2xx (a `503` means the database is unreachable). Public status page: see the URLs table.

## Secrets

Never commit `.env*` files (they're git-ignored), connection strings, or tokens. Never paste them into PRs, issues, chat,
or AI tools. Values live only in Vercel (and, if we use the Actions deploy fallback, GitHub → Settings → Secrets).
