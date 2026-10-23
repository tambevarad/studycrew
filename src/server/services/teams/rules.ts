/**
 * Pure rules for teams (PB-04). No database access, so they are unit-tested directly.
 */
import { randomBytes } from "node:crypto";
import { INVITE_TTL_DAYS, MAX_TEAM_SIZE, type TeamRoleValue } from "@/contracts/teams";

export const INVITE_CODE_LENGTH = 10;
const DAY_MS = 86_400_000;

/** 10 random URL-safe characters for /join/<code> links (~60 bits, so guessing one is impractical). */
export function generateInviteCode(): string {
  return randomBytes(8).toString("base64url").slice(0, INVITE_CODE_LENGTH);
}

/** Trims, lowercases, and de-duplicates invite emails, keeping the order they were typed in. */
export function normalizeEmails(emails: readonly string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
}

export function isInviteLive(invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date) {
  return invite.acceptedAt === null && invite.revokedAt === null && invite.expiresAt > now;
}

export function isFull(memberCount: number): boolean {
  return memberCount >= MAX_TEAM_SIZE;
}

/** Leaders first, then by join date (oldest first), as `TeamDetailDTO.members` promises. */
export function sortMembers<T extends { role: TeamRoleValue; joinedAt: Date }>(members: readonly T[]): T[] {
  return [...members].sort(
    (a, b) => (a.role === b.role ? 0 : a.role === "LEADER" ? -1 : 1) || a.joinedAt.getTime() - b.joinedAt.getTime(),
  );
}

/**
 * Would this change leave the team without a leader? (AC8: the last leader can't leave or be demoted.)
 * `leaderCount` is the number of leaders before the change.
 */
export function wouldRemoveLastLeader(targetRole: TeamRoleValue, leaderCount: number): boolean {
  return targetRole === "LEADER" && leaderCount <= 1;
}

/** "a@x.edu", "a@x.edu and b@y.edu", "a@x.edu, b@y.edu, and 2 more". */
export function summarizeList(items: readonly string[], max = 2): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  if (items.length <= max) return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  return `${items.slice(0, max).join(", ")}, and ${items.length - max} more`;
}
