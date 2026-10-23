import { describe, expect, it } from "vitest";
import {
  rateLimitMessage,
  retryAfterSeconds,
  safeNextPath,
  validateAuthFields,
} from "@/components/features/auth/validation";
import { addChip, COURSE_RULES, SKILL_RULES } from "@/components/features/profile/chips";
import { dedupeCourses, dedupeSkills } from "@/server/services/profile/normalize";

describe("PB-02 profile list normalization (server)", () => {
  it("AC5: normalizes course codes and keeps one “CSE 6324”", () => {
    expect(dedupeCourses(["cse6324", "CSE 6324", " cse-5311 ", "CSE6324"])).toEqual(["CSE 6324", "CSE 5311"]);
  });

  it("de-duplicates skills case-insensitively, keeping the first spelling and order", () => {
    expect(dedupeSkills(["React", " react ", "UI  design", "Testing", "ui design", ""])).toEqual([
      "React",
      "UI design",
      "Testing",
    ]);
  });
});

describe("PB-02 chip input rules (client)", () => {
  it("AC5: adds a normalized course and rejects the same course typed differently", () => {
    const first = addChip([], "cse6324", COURSE_RULES);
    expect(first).toEqual({ ok: true, values: ["CSE 6324"], added: "CSE 6324" });
    const again = addChip(["CSE 6324"], "CSE 6324", COURSE_RULES);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("already in your list");
  });

  it("enforces the 12-course and 20-skill limits with a helpful message", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `CSE ${5300 + i}`);
    const full = addChip(twelve, "CSE 6324", COURSE_RULES);
    expect(full).toEqual({ ok: false, error: "You can add at most 12 courses. Remove one first." });
    const twenty = Array.from({ length: 20 }, (_, i) => `Skill ${i}`);
    expect(addChip(twenty, "One more", SKILL_RULES).ok).toBe(false);
  });

  it("rejects empty, too-short, and too-long values; skills compare case-insensitively", () => {
    expect(addChip([], "   ", SKILL_RULES)).toEqual({ ok: false, error: "Type a skill first." });
    expect(addChip([], "a", COURSE_RULES).ok).toBe(false);
    expect(addChip([], "x".repeat(41), SKILL_RULES).ok).toBe(false);
    expect(addChip(["Testing"], "testing", SKILL_RULES).ok).toBe(false);
  });
});

describe("PB-02 auth form validation", () => {
  it("AC1/AC7: requires a name, a valid email, and an 8+ character password to sign up", () => {
    expect(validateAuthFields("sign-up", { name: " ", email: "nope", password: "short" })).toEqual({
      name: "Enter your name.",
      email: "Enter an email like you@school.edu.",
      password: "Use at least 8 characters.",
    });
    expect(validateAuthFields("sign-up", { name: "Ana", email: "ana@uta.edu", password: "12345678" })).toEqual({});
  });

  it("sign-in only checks that both fields are filled in", () => {
    expect(validateAuthFields("sign-in", { name: "", email: "a@b.co", password: "x" })).toEqual({});
    expect(validateAuthFields("sign-in", { name: "", email: "", password: "" })).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
  });

  it("429: reads X-Retry-After and says how long to wait", () => {
    expect(retryAfterSeconds("8")).toBe(8);
    expect(retryAfterSeconds("2.2")).toBe(3);
    expect(retryAfterSeconds("0")).toBeNull();
    expect(retryAfterSeconds("soon")).toBeNull();
    expect(retryAfterSeconds(null)).toBeNull();
    expect(rateLimitMessage(8)).toBe("Too many attempts. Try again in 8 seconds.");
    expect(rateLimitMessage(1)).toBe("Too many attempts. Try again in 1 second.");
    expect(rateLimitMessage(61)).toBe("Too many attempts. Try again in 2 minutes.");
    expect(rateLimitMessage(null)).toBe("Too many attempts. Wait a few seconds, then try again.");
  });

  it("only follows same-site ?next= paths", () => {
    expect(safeNextPath("/teams/abc")).toBe("/teams/abc");
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
