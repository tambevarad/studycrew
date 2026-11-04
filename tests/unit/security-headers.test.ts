import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// D-07 (PB-17): the headers ZAP's baseline found missing on staging, plus the three that were already there.
async function headersFor(path: string) {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === "/:path*");
  expect(rule, `no header rule covers ${path}`).toBeDefined();
  return Object.fromEntries(rule!.headers.map((h) => [h.key, h.value]));
}

function directives(csp: string) {
  return Object.fromEntries(
    csp.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("security headers (D-07)", () => {
  it("D-07: every path gets a CSP, Permissions-Policy, COOP and CORP, and keeps the earlier three", async () => {
    const h = await headersFor("/");
    expect(Object.keys(h)).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Content-Security-Policy",
        "Permissions-Policy",
        "Cross-Origin-Opener-Policy",
        "Cross-Origin-Resource-Policy",
      ]),
    );
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });

  it("D-07: the CSP allows only this origin, blocks framing and plugins, and keeps forms on-site", async () => {
    const d = directives((await headersFor("/"))["Content-Security-Policy"]);
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["connect-src"]).toEqual(["'self'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    // No other origins anywhere, and no eval outside `next dev` (tests run with NODE_ENV=test).
    for (const values of Object.values(d)) expect(values.every((v) => !v.includes("://"))).toBe(true);
    expect(d["script-src"]).not.toContain("'unsafe-eval'");
  });
});
