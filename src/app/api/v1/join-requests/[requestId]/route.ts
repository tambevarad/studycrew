import { authedRoute } from "@/server/http";
import { cancelJoinRequest } from "@/server/services/teams/service";

export const DELETE = authedRoute<{ requestId: string }>(async ({ params, user }) =>
  cancelJoinRequest(params.requestId, user.id),
);
