# perf/ — NFR-01 load test and Lighthouse helper (PB-17)

| File | What it does |
|---|---|
| `seed-load.ts` | Adds load-test data: 10 users `load-01…10@studycrew.test`, 50 teams in course `LOAD 9000`, 2,000 tasks, 300 meetings, activity. **Adds only, never deletes, never calls `prisma/seed.ts`.** Idempotent: stops if `Load Team 01` exists. `--dry-run` prints the plan. |
| `load.js` | k6: 100 VUs for 5 min (+30 s ramp up, 15 s down). Mix: board 30 %, calendar 20 %, activity 20 %, notifications 20 %, create + move a task 10 %. No AI calls. Thresholds: `p(95) < 800 ms`, errors `< 1 %` on `kind:api` requests (sign-in excluded). |
| `lhci-login.cjs` | Lighthouse CI signs in once (seed demo account) so signed-in pages are audited. |
| `results/` | Output (git-ignored): `k6-summary.json`, `lighthouse/`. |

## Order of the final run (after PB-14, PB-15, and PB-16 are merged and deployed)

Staging is also the demo site and the site for the usability sessions. **Ask Dev before each step that touches it**, and
pick a window when no usability session is scheduled (ask Krish).

1. **Seed the load data on staging, once (Dev, in his own PowerShell window).** Both values are typed into a hidden
   prompt, so they never appear on screen, on the command line, in PowerShell history, or in a file:
   ```powershell
   $env:DATABASE_URL = [Net.NetworkCredential]::new('', (Read-Host 'Neon DIRECT connection string' -AsSecureString)).Password
   $a = [Net.NetworkCredential]::new('', (Read-Host 'Load-test password, 12+ characters' -AsSecureString)).Password
   $b = [Net.NetworkCredential]::new('', (Read-Host 'Same password again' -AsSecureString)).Password
   if ($a -ceq $b) { $env:LOAD_TEST_PASSWORD = $a; 'Passwords match' } else { 'They do not match: run these three lines again' }; Remove-Variable a, b
   npx tsx perf/seed-load.ts --dry-run   # check "Target database:" is the Neon host, not localhost
   npx tsx perf/seed-load.ts
   Remove-Item Env:DATABASE_URL, Env:LOAD_TEST_PASSWORD
   ```
   In Git Bash, use `read -rs DATABASE_URL && export DATABASE_URL` (and the same for `LOAD_TEST_PASSWORD`) instead.
   Running it again is safe: it stops if `Load Team 01` already exists. Paste the password from your password manager
   rather than typing it, since the prompt is hidden. If the load users can't sign in later (HTTP 401), the password
   was mistyped: set it again as above and run `npx tsx perf/seed-load.ts --reset-password`, which changes only the
   10 load accounts' password.
2. **The repo owner (Varad) adds the same password** as the repository secret `LOAD_TEST_PASSWORD`: Settings → Secrets
   and variables → Actions → New repository secret, or `gh secret set LOAD_TEST_PASSWORD --repo tambevarad/studycrew`
   (it prompts for the value). Share the password through a private channel, never in chat, git, or a PR.
3. **Run** Actions → **NFR checks** → Run workflow → tick every box → target `https://studycrew-staging.vercel.app`.
   ZAP, Lighthouse, and k6 run one after another (about 25 min in total), so they don't skew each other's numbers.
4. Copy the results and the run link into `docs/test-report.md` §5 (NFR-01, NFR-02, NFR-03).

The load users and teams stay on staging afterwards. They're private (`isOpen: false`), so they don't show up in
anyone's course search. `staging-cleanup.md` lists everything the test runs leave behind.
