# security/ — NFR-02 checks (PB-17)

Pass criterion: 0 high/critical findings, and 100 % of team routes return 403 to non-members (the authz sweep,
`tests/integration/authz-sweep.test.ts`, already runs in CI).

| Check | Command | Output |
|---|---|---|
| Dependency audit | `node security/npm-audit.mjs` | Summary by severity; `security/out/npm-audit.json`. Exit 1 on high/critical. |
| Client-bundle secret scan | `npm run build && node security/scan-client-bundle.mjs` | Fails on key-shaped strings, or on the **value** of any server-only env var that is set. Prints file + kind only, never the match. Env-var **names** are warnings (libraries mention them). |
| OWASP ZAP baseline | Actions → **NFR checks** → tick *zap* | Passive scan of the target (no attacks). Report in the run's artifacts. Overrides with reasons: `zap-rules.tsv`. |

All three also run from `.github/workflows/nfr.yml` (manual only). Record the results with the run link in
`docs/test-report.md` §5 (NFR-02).
