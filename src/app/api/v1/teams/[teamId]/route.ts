import { updateTeamInput } from "@/contracts/teams";
import { teamRoute } from "@/server/http";
import { getTeam, updateTeam } from "@/server/services/teams/service";

export const GET = teamRoute(async ({ params, user }) => getTeam(params.teamId, user.id));

/**
 * `updateTeamInput` is `createTeamInput.partial()`, and Zod still applies `isOpen`'s `.default(true)` inside it, so a
 * rename would silently re-list a closed team. Only pass `isOpen` on when the body actually sent it
 * (docs/contract-requests/PB-04-update-team-isopen-default.md).
 */
export const PATCH = teamRoute(
  async ({ req, params, user }) => {
    const raw: unknown = await req.json().catch(() => ({}));
    const input = updateTeamInput.parse(raw);
    const sentIsOpen = typeof raw === "object" && raw !== null && "isOpen" in raw;
    return updateTeam(params.teamId, user.id, sentIsOpen ? input : { ...input, isOpen: undefined });
  },
  { leaderOnly: true },
);
