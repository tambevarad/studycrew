import { voteInput } from "@/contracts/polls";
import { parseBody, teamRoute } from "@/server/http";
import { vote } from "@/server/services/polls/service";

/** PB-14 — set or change my vote (409 once the poll has closed). */
export const PUT = teamRoute<{ pollId: string }>(async ({ req, params, user }) =>
  vote(params.teamId, user.id, params.pollId, await parseBody(req, voteInput)),
);
