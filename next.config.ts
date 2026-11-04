import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// D-07 (ZAP baseline, PB-17), docs/contract-requests/PB-17-security-headers.md. Phase 1: everything here is
// same-origin, so this blocks framing, plugins, <base> hijacking, off-site form posts, and fetches to other hosts.
// Inline scripts and styles stay allowed: Next's hydration scripts and our style={} attributes need them until
// phase 2 (per-request nonces from src/proxy.ts, which would make every page dynamic). Dev adds what `next dev` needs.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Cache Components is intentionally OFF: every page depends on the signed-in
  // user, and the classic dynamic model is simpler for parallel feature work.
  // See docs/contracts/00-architecture.md → "Rendering model".
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
