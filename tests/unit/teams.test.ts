import { describe, expect, it } from "vitest";
import { createTeamInput, INVITE_TTL_DAYS, MAX_TEAM_SIZE, updateTeamInput } from "@/contracts/teams";
import {
  generateInviteCode,
  inviteExpiry,
  isFull,
  isInviteLive,
  normalizeEmails,
  sortMembers,
  summarizeList,
  wouldRemoveLastLeader,
} from "@/server/services/teams/rules";
import { inviteExpiryLabels, joinRequestLabels } from "@/components/features/teams/labels";
import { inviteLink, parseEmailList } from "@/components/features/teams/team-utils";

describe("PB-04 team rules", () => {
  it("AC1: course codes are normalized by the contract (“cse6324” → “CSE 6324”)", () => {
    expect(createTeamInput.parse({ name: "Graph Wizards", courseCode: "cse6324" }).courseCode).toBe("CSE 6324");
    expect(createTeamInput.parse({ name: "Graph Wizards", courseCode: " CSE-6324 " }).courseCode).toBe("CSE 6324");
  });

  it("documents the contract quirk the PATCH route works around: partial() still defaults isOpen", () => {
    expect(updateTeamInput.parse({ name: "Renamed" })).toHaveProperty("isOpen", true);
  });

  it("invite codes are 10 URL-safe characters and don't repeat", () => {
    const codes = Array.from({ length: 200 }, generateInviteCode);
    for (const c of codes) expect(c).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("normalizes invite emails: trim, lowercase, de-duplicate, keep order", () => {
    expect(normalizeEmails([" B@x.edu", "a@x.edu", "b@X.EDU ", ""])).toEqual(["b@x.edu", "a@x.edu"]);
  });

  it("invites expire after INVITE_TTL_DAYS and are live only until accepted, revoked, or expired", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    const expiresAt = inviteExpiry(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000);
    const base = { acceptedAt: null, revokedAt: null, expiresAt };
    expect(isInviteLive(base, now)).toBe(true);
    expect(isInviteLive({ ...base, acceptedAt: now }, now)).toBe(false);
    expect(isInviteLive({ ...base, revokedAt: now }, now)).toBe(false);
    expect(isInviteLive(base, expiresAt)).toBe(false);
  });

  it(`AC7: a team of ${MAX_TEAM_SIZE} is full`, () => {
    expect(isFull(MAX_TEAM_SIZE - 1)).toBe(false);
    expect(isFull(MAX_TEAM_SIZE)).toBe(true);
  });

  it("AC8: removing or demoting the only leader is blocked; members and second leaders are fine", () => {
    expect(wouldRemoveLastLeader("LEADER", 1)).toBe(true);
    expect(wouldRemoveLastLeader("LEADER", 2)).toBe(false);
    expect(wouldRemoveLastLeader("MEMBER", 1)).toBe(false);
  });

  it("sorts members leaders first, then oldest first", () => {
    const d = (day: number) => new Date(`2026-10-0${day}T00:00:00Z`);
    const sorted = sortMembers([
      { id: "m2", role: "MEMBER" as const, joinedAt: d(3) },
      { id: "l2", role: "LEADER" as const, joinedAt: d(4) },
      { id: "m1", role: "MEMBER" as const, joinedAt: d(1) },
      { id: "l1", role: "LEADER" as const, joinedAt: d(2) },
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["l1", "l2", "m1", "m2"]);
  });

  it("summarizes lists for activity text", () => {
    expect(summarizeList([])).toBe("");
    expect(summarizeList(["a"])).toBe("a");
    expect(summarizeList(["a", "b"])).toBe("a and b");
    expect(summarizeList(["a", "b", "c"], 4)).toBe("a, b, and c");
    expect(summarizeList(["a", "b", "c", "d"])).toBe("a, b, and 2 more");
  });
});

describe("PB-04 client helpers", () => {
  it("splits typed emails on commas, spaces, semicolons, and new lines", () => {
    expect(parseEmailList("a@x.edu, b@x.edu;c@x.edu\n d@x.edu  e@x.edu")).toEqual([
      "a@x.edu",
      "b@x.edu",
      "c@x.edu",
      "d@x.edu",
      "e@x.edu",
    ]);
    expect(parseEmailList("  ")).toEqual([]);
  });

  it("builds the shareable /join link from the current origin", () => {
    expect(inviteLink("https://studycrew.example", "abc123XYZ_")).toBe("https://studycrew.example/join/abc123XYZ_");
  });
});

describe("PB-04 server-built date labels (no Intl in client components)", () => {
  const now = new Date("2026-10-23T17:00:00Z");
  const user = { id: "u1", name: "Olivia", email: "o@x.edu", image: null };
  const team = { id: "t1", name: "Core", courseCode: "CSE 6324" };

  it("labels invite expiry in the viewer's time zone", () => {
    const invite = { id: "i1", team, email: "o@x.edu", invitedBy: user, createdAt: now.toISOString(), expiresAt: "2026-11-06T03:00:00Z" };
    expect(inviteExpiryLabels([invite], "America/Chicago")).toEqual({ i1: "expires Nov 5, 2026" });
    expect(inviteExpiryLabels([invite], "Asia/Kolkata")).toEqual({ i1: "expires Nov 6, 2026" });
  });

  it("labels requests as sent / answered relative to now", () => {
    const base = { team, user, message: null };
    const labels = joinRequestLabels(
      [
        { ...base, id: "p", status: "PENDING", createdAt: "2026-10-23T14:00:00Z", decidedAt: null },
        { ...base, id: "a", status: "APPROVED", createdAt: "2026-10-21T17:00:00Z", decidedAt: "2026-10-23T16:30:00Z" },
      ],
      now,
      "America/Chicago",
    );
    expect(labels).toEqual({ p: "Sent 3 h ago", a: "Sent 2 d ago · answered 30 min ago" });
  });
});
