import { describe, expect, it } from "vitest";
import { safeNextPath, signInPathFor } from "@/lib/safe-next";

/** What a browser does with the value: resolve it against our origin. */
const landsOn = (path: string) => new URL(path, "https://studycrew-staging.vercel.app").origin;

describe("D-01 safeNextPath: only same-origin relative paths", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeNextPath("/join/core-cse6324-demo")).toBe("/join/core-cse6324-demo");
    expect(safeNextPath("/teams/t1/board?task=abc")).toBe("/teams/t1/board?task=abc");
    expect(safeNextPath("/teams/t1/calendar#week")).toBe("/teams/t1/calendar#week");
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["absolute URL", "https://evil.com/join/x"],
    ["javascript: scheme", "javascript:alert(1)"],
    ["no leading slash", "join/abc"],
    ["tab that browsers strip to //", "/\t/evil.com"],
    ["newline that browsers strip to //", "/\n/evil.com"],
    ["carriage return", "/\r/evil.com"],
    ["empty", ""],
    ["missing", null],
  ])("rejects %s", (_label, raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it("never returns a value that a browser would resolve to another origin", () => {
    const attempts = ["/%2F%2Fevil.com", "/./evil.com", "/..//evil.com", "/join/../../evil.com", "/ /evil.com"];
    for (const raw of attempts) {
      const out = safeNextPath(raw);
      if (out !== null) expect(landsOn(out), raw).toBe("https://studycrew-staging.vercel.app");
    }
  });

  it("rejects very long values", () => {
    expect(safeNextPath(`/${"a".repeat(3000)}`)).toBeNull();
  });
});

describe("D-01 signInPathFor", () => {
  it("adds an encoded next for the page the visitor wanted", () => {
    expect(signInPathFor("/join/core-cse6324-demo")).toBe("/sign-in?next=%2Fjoin%2Fcore-cse6324-demo");
    expect(signInPathFor("/teams/t1/board", "?task=abc")).toBe("/sign-in?next=%2Fteams%2Ft1%2Fboard%3Ftask%3Dabc");
  });

  it("falls back to plain /sign-in when the path isn't safe", () => {
    expect(signInPathFor("//evil.com")).toBe("/sign-in");
  });
});
