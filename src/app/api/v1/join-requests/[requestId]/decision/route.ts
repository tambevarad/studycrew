import { decideJoinRequestInput } from "@/contracts/teams";
import { authedRoute, parseBody } from "@/server/http";
import { decideJoinRequest } from "@/server/services/teams/service";

/** The service checks the caller leads the request's team (403 otherwise, AC5). */
export const POST = authedRoute<{ requestId: string }>(async ({ req, params, user }) =>
  decideJoinRequest(params.requestId, user.id, await parseBody(req, decideJoinRequestInput)),
);
