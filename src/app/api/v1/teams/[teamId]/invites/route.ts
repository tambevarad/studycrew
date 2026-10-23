import { inviteByEmailInput } from "@/contracts/teams";
import { created, parseBody, teamRoute } from "@/server/http";
import { inviteByEmail } from "@/server/services/teams/service";

export const POST = teamRoute(
  async ({ req, params, user }) =>
    created(await inviteByEmail(params.teamId, user.id, await parseBody(req, inviteByEmailInput))),
  { leaderOnly: true },
);
