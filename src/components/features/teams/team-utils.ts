/** Pure helpers for the PB-04 team screens (unit-tested in tests/unit/teams.test.ts). */
import { MAX_TEAM_SIZE } from "@/contracts/teams";

/** Splits what someone typed or pasted into the invite box: commas, semicolons, spaces, or new lines. */
export function parseEmailList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export function inviteLink(origin: string, inviteCode: string): string {
  return `${origin}/join/${inviteCode}`;
}

export function seatsLabel(memberCount: number): string {
  return `${memberCount} of ${MAX_TEAM_SIZE} members`;
}

export function isTeamFull(memberCount: number): boolean {
  return memberCount >= MAX_TEAM_SIZE;
}
