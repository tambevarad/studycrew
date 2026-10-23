import "server-only";
/**
 * Date text for the PB-04 screens, built in Server Components and passed down as plain strings.
 * Whole-string Intl output differs between Node's and the browser's ICU, so client components must not format dates
 * themselves or React reports a hydration mismatch (#418; see components/features/meetings/format.ts).
 */
import type { JoinRequestDTO, TeamInviteDTO } from "@/contracts/teams";
import { formatDate, relativeTime } from "@/lib/dates";

/** invite id → "expires Nov 6, 2026" */
export function inviteExpiryLabels(invites: readonly TeamInviteDTO[], timeZone: string): Record<string, string> {
  return Object.fromEntries(invites.map((i) => [i.id, `expires ${formatDate(i.expiresAt, timeZone)}`]));
}

/** request id → "Sent 2 d ago · answered 3 h ago" (or just the sent part while pending). */
export function joinRequestLabels(
  requests: readonly JoinRequestDTO[],
  now: Date,
  timeZone: string,
): Record<string, string> {
  return Object.fromEntries(
    requests.map((r) => [
      r.id,
      `Sent ${relativeTime(r.createdAt, now, timeZone)}` +
        (r.decidedAt ? ` · answered ${relativeTime(r.decidedAt, now, timeZone)}` : ""),
    ]),
  );
}
