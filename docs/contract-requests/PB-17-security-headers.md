# Contract request: security headers for every response (D-07)

Requested by: Dev Patel for PB-17 · Date: 2026-11-03 · **Status: phase 1 proposed in this PR; phase 2 open**

## What I need

Every response should send a Content Security Policy and the other browser-hardening headers that the OWASP ZAP
baseline found missing on staging. The headers live in the shared `next.config.ts`, so no feature item can add them.

## What ZAP found (NFR-02 runs on Nov 3, `docs/test-report.md` §5)

| ZAP alert | Risk | Today |
|---|---|---|
| 10038 Content Security Policy (CSP) Header Not Set | Medium | no CSP |
| 10063 Permissions Policy Header Not Set | Low | none |
| 90004 Cross-Origin-Opener-Policy / -Resource-Policy / -Embedder-Policy missing | Low | none |
| 10098 Cross-Domain Misconfiguration (`Access-Control-Allow-Origin: *` on `/_next/static`) | Medium | Vercel's default |

`next.config.ts` already sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a `Referrer-Policy`.
NFR-02's target (0 high/critical) is met either way. This is defence in depth.

## Proposed change, phase 1 (this PR)

Extend `headers()` in `next.config.ts` for `/:path*`:

- `Content-Security-Policy`: `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self'
  'unsafe-inline'`, `img-src 'self' data: blob:`, `font-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. `next dev` also gets `'unsafe-eval'` and `ws:`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`

The app loads nothing from other origins (fonts are self-hosted by `next/font`, AI calls are server-side), so
`'self'` everywhere is safe. This already blocks framing, plugins, `<base>` hijacking, forms posting off-site, and
scripts sending data to other hosts.

**Not included, on purpose:**

- `Cross-Origin-Embedder-Policy`: we don't need cross-origin isolation, and `require-corp` can break embeds. Accepted
  as a ZAP Low.
- The static-file CORS header (10098): Vercel sets it on public, content-hashed assets that contain no secrets (the
  bundle scan checks this). Accepted.
- `upgrade-insecure-requests`: it would break `next start` on `http://localhost`. Vercel already serves HTTPS only.

## Phase 2 (open, after the Nov 7 submission)

Replace `'unsafe-inline'` in `script-src` with a per-request nonce from `src/proxy.ts`, as in the Next 16 guide
(`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). That needs every page to render
dynamically, plus a proxy matcher for all pages, so it's a bigger change than this late in the sprint. Until then, ZAP
will report 10055 "CSP: script-src unsafe-inline" (Medium) instead of "CSP not set".

## How it was checked

- `tests/unit/security-headers.test.ts`: the headers are present, the CSP allows only `'self'`, and there's no
  `'unsafe-eval'` outside `next dev`.
- `npm run build && npm run start`, then `curl -I`: all 7 headers on pages and on `/api/health`.
- Built-in browser, signed in as the demo account. All 19 pages from the a11y sweep loaded with **no console errors**;
  a poll was created (dialog, POST, toast) and the page hydrated. Control: a `fetch("https://example.com")` from the page
  was blocked by `connect-src`, with a CSP error in the console, so the console check would have caught a violation.
- Full Cypress suite in Chrome on a fresh local seed. Cypress strips CSP headers, so this checks the other headers and
  the app; the browser check above covers the CSP.

## Who else is affected

Everyone, but nothing should change visibly. If a future feature needs another origin (an embedded video, an external
image), add it to the matching directive in `next.config.ts` through a contract request.

**Timing:** staging redeploys on merge, and Krish's usability sessions run on staging (Wed and Thu, 3:30–6:15 pm CST).
Merge outside those windows, then open staging once and check the console before the next session.
