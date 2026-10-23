import { createJoinRequestInput } from "@/contracts/teams";
import { authedRoute, created, parseBody } from "@/server/http";
import { requestToJoin } from "@/server/services/teams/service";

/** Sent by a non-member, so it lives outside teams/[teamId] (api.md § PB-04). */
export const POST = authedRoute(async ({ req, user }) =>
  created(await requestToJoin(user.id, await parseBody(req, createJoinRequestInput))),
);
