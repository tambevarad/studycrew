import { readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const BASE = "http://localhost:3000";

function visit(pathAndQuery: string, cookie?: string) {
  return proxy(new NextRequest(`${BASE}${pathAndQuery}`, { headers: cookie ? { cookie } : {} }));
}

describe("D-01 proxy: signed-out visitors keep their destination", () => {
  it("redirects a signed-out invite link to sign-in with next", () => {
    const res = visit("/join/core-cse6324-demo");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${BASE}/sign-in?next=%2Fjoin%2Fcore-cse6324-demo`);
  });

  it("keeps the query string (notification deep links)", () => {
    const res = visit("/teams/t1/board?task=abc");
    expect(res.headers.get("location")).toBe(`${BASE}/sign-in?next=%2Fteams%2Ft1%2Fboard%3Ftask%3Dabc`);
  });

  it("lets requests with a session cookie through (local and __Secure- production names)", () => {
    for (const cookie of ["better-auth.session_token=abc", "__Secure-better-auth.session_token=abc"]) {
      const res = visit("/join/core-cse6324-demo", cookie);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("covers every top-level folder of the signed-in (app) area", () => {
    const appDir = path.resolve(__dirname, "../../src/app/(app)");
    const folders = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/${d.name}/:path*`)
      .sort();
    expect([...config.matcher].sort()).toEqual(folders);
  });
});
