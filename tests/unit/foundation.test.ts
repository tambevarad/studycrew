import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { dayAndHalfHour, slotOf, TOTAL_SLOTS } from "@/contracts/availability";
import { isValidTimeZone, normalizeCourseCode } from "@/contracts/common";
import { runCoverageInput } from "@/contracts/coverage";
import { createMeetingInput } from "@/contracts/meetings";
import { createPollInput } from "@/contracts/polls";
import { createResourceInput } from "@/contracts/resources";
import { dueLabel, relativeTime } from "@/lib/dates";
import { initials, pluralize } from "@/lib/utils";
import { AppError, errors, toErrorResponse } from "@/server/errors";

describe("contracts", () => {
  it("normalizes course codes", () => {
    expect(normalizeCourseCode("cse6324")).toBe("CSE 6324");
    expect(normalizeCourseCode(" CSE-6324 ")).toBe("CSE 6324");
    expect(normalizeCourseCode("math 2414h")).toBe("MATH 2414H");
    expect(normalizeCourseCode("Intro Bio")).toBe("INTRO BIO");
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });

  it("encodes availability slots", () => {
    expect(TOTAL_SLOTS).toBe(336);
    expect(slotOf(1, 2)).toBe(50);
    expect(dayAndHalfHour(50)).toEqual({ day: 1, halfHour: 2 });
  });

  it("rejects meetings that end before they start or run over 8 hours", () => {
    const base = { title: "x", startsAt: "2026-10-24T15:00:00Z" };
    expect(createMeetingInput.safeParse({ ...base, endsAt: "2026-10-24T16:00:00Z" }).success).toBe(true);
    expect(createMeetingInput.safeParse({ ...base, endsAt: "2026-10-24T14:00:00Z" }).success).toBe(false);
    expect(createMeetingInput.safeParse({ ...base, endsAt: "2026-10-25T01:00:00Z" }).success).toBe(false);
  });

  it("requires consent for the AI check and valid links for resources", () => {
    const ok = { title: "t", workType: "REPORT", instructions: "i", draft: "d", consent: true };
    expect(runCoverageInput.safeParse(ok).success).toBe(true);
    expect(runCoverageInput.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(createResourceInput.safeParse({ type: "LINK", title: "x", url: "https://a.b" }).success).toBe(true);
    expect(createResourceInput.safeParse({ type: "LINK", title: "x", url: "ftp://a.b" }).success).toBe(false);
  });

  it("limits polls to 2–6 distinct options", () => {
    const base = { question: "q", closesAt: "2026-10-30T00:00:00Z" };
    expect(createPollInput.safeParse({ ...base, options: ["a"] }).success).toBe(false);
    expect(createPollInput.safeParse({ ...base, options: ["a", "A"] }).success).toBe(false);
    expect(createPollInput.safeParse({ ...base, options: ["a", "b", "c"] }).success).toBe(true);
  });
});

describe("errors", () => {
  it("maps AppError, ZodError, Prisma codes, and unknown errors", async () => {
    const r1 = toErrorResponse(errors.forbidden());
    expect(r1.status).toBe(403);
    expect(await r1.json()).toMatchObject({ error: { code: "FORBIDDEN" } });

    let zerr: ZodError | null = null;
    try {
      z.object({ a: z.string() }).parse({});
    } catch (e) {
      zerr = e as ZodError;
    }
    const r2 = toErrorResponse(zerr);
    expect(r2.status).toBe(400);
    expect((await r2.json()).error.details.fields.a).toBeTruthy();

    expect(toErrorResponse({ code: "P2025" }).status).toBe(404);
    expect(toErrorResponse({ code: "P2002" }).status).toBe(409);
    const orig = console.error;
    console.error = () => {};
    expect(toErrorResponse(new Error("boom")).status).toBe(500);
    console.error = orig;

    expect(new AppError("RATE_LIMITED", "x").status).toBe(429);
    expect(errors.upstream("x").status).toBe(502);
    expect(errors.conflict("x").status).toBe(409);
    expect(errors.rateLimited("x").status).toBe(429);
    expect(errors.validation("x").status).toBe(400);
    expect(errors.notFound().message).toContain("could not be found");
    expect(errors.unauthenticated().status).toBe(401);
  });
});

describe("lib", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  it("formats relative and due times", () => {
    expect(relativeTime("2026-10-22T11:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-10-22T11:50:00Z", now)).toBe("10 min ago");
    expect(relativeTime("2026-10-22T09:00:00Z", now)).toBe("3 h ago");
    expect(relativeTime("2026-10-20T12:00:00Z", now)).toBe("2 d ago");
    expect(dueLabel("2026-10-22T10:00:00Z", now)).toBe("Overdue by 2 h");
    expect(dueLabel("2026-10-19T12:00:00Z", now)).toBe("Overdue by 3 d");
    expect(dueLabel("2026-10-22T17:00:00Z", now)).toBe("Due in 5 h");
    expect(dueLabel("2026-10-30T17:00:00Z", now)).toMatch(/^Due Oct 30/);
  });
  it("builds initials and plurals", () => {
    expect(initials("Varad Tambe")).toBe("VT");
    expect(initials("cher")).toBe("CH");
    expect(initials("  ")).toBe("?");
    expect(pluralize(1, "member")).toBe("1 member");
    expect(pluralize(3, "member")).toBe("3 members");
  });
});
