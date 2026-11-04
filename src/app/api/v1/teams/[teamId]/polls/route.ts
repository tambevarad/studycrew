import { createPollInput } from "@/contracts/polls";
import { created, parseBody, teamRoute } from "@/server/http";
import { createPoll, listPolls } from "@/server/services/polls/service";

/** PB-14 — GET the team's polls (closes any whose time has passed first), POST start a poll. */
export const GET = teamRoute(async ({ params, user }) => listPolls(params.teamId, user.id));

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await createPoll(params.teamId, user.id, await parseBody(req, createPollInput))),
);
