import { createTeamInput, searchTeamsQuery } from "@/contracts/teams";
import { authedRoute, created, parseBody, parseQuery } from "@/server/http";
import { createTeam, searchTeams } from "@/server/services/teams/service";

export const GET = authedRoute(async ({ req, user }) => searchTeams(user.id, parseQuery(req, searchTeamsQuery)));

export const POST = authedRoute(async ({ req, user }) =>
  created(await createTeam(user.id, await parseBody(req, createTeamInput))),
);
