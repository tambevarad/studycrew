import { updateTeamInput } from "@/contracts/teams";
import { parseBody, teamRoute } from "@/server/http";
import { getTeam, updateTeam } from "@/server/services/teams/service";

export const GET = teamRoute(async ({ params, user }) => getTeam(params.teamId, user.id));

/** `updateTeamInput` leaves `isOpen` undefined unless the body sends it, so a rename keeps a closed team closed (#60). */
export const PATCH = teamRoute(
  async ({ req, params, user }) => updateTeam(params.teamId, user.id, await parseBody(req, updateTeamInput)),
  { leaderOnly: true },
);
