# perf/ — NFR-01 load test and Lighthouse helper (PB-17)

| File | What it does |
|---|---|
| `seed-load.ts` | Adds load-test data: 10 users `load-01…10@studycrew.test`, 50 teams in course `LOAD 9000`, 2,000 tasks, 300 meetings, activity. **Adds only, never deletes, never calls `prisma/seed.ts`.** Idempotent: stops if `Load Team 01` exists. `--dry-run` prints the plan. |
| `load.js` | k6: 100 VUs for 5 min (+30 s ramp up, 15 s down). Mix: board 30 %, calendar 20 %, activity 20 %, notifications 20 %, create + move a task 10 %. No AI calls. Thresholds: `p(95) < 800 ms`, errors `< 1 %` on `kind:api` requests (sign-in excluded). |
| `lhci-login.cjs` | Lighthouse CI signs in once (seed demo account) so signed-in pages are audited. |
| `results/` | Output (git-ignored): `k6-summary.json`, `lighthouse/`. |

## Order of the final run (after PB-14, PB-15, and PB-16 are merged and deployed)

1. **Seed the load data on staging, once.** Ask Dev first: staging is the demo site. In your own shell, with the Neon **direct**
   URL:
   ```sh
   DATABASE_URL=<neon direct url> LOAD_TEST_PASSWORD=<choose one> npx tsx perf/seed-load.ts
   ```
   Add the same password as the GitHub secret `LOAD_TEST_PASSWORD` (repo owner).
2. **Run** Actions → **NFR checks** → tick *load* (and *lighthouse*) → target `https://studycrew-staging.vercel.app`.
   Or run locally: `BASE_URL=… LOAD_TEST_PASSWORD=… k6 run perf/load.js`.
3. Copy p95, error rate, and the run link into `docs/test-report.md` §5 (NFR-01).

The load users and teams stay on staging afterwards. They're private (`isOpen: false`), so they don't show up in
anyone's course search.
