import { changeRoleInput } from "@/contracts/teams";
import { parseBody, teamRoute } from "@/server/http";
import { changeRole, removeMember } from "@/server/services/teams/service";

type P = { teamId: string; userId: string };

export const PATCH = teamRoute<P>(
  async ({ req, params, user }) =>
    changeRole(params.teamId, user.id, params.userId, await parseBody(req, changeRoleInput)),
  { leaderOnly: true },
);

/** A leader removes someone, or any member removes themselves (leave). The service decides which. */
export const DELETE = teamRoute<P>(async ({ params, user }) => removeMember(params.teamId, user.id, params.userId));
