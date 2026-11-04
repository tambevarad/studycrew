import { teamRoute } from "@/server/http";
import { closePoll } from "@/server/services/polls/service";

/** PB-14 — close a poll early (its creator or a team leader). */
export const POST = teamRoute<{ pollId: string }>(async ({ params, user }) =>
  closePoll(params.teamId, user.id, params.pollId),
);
