import { listActivityQuery } from "@/contracts/activity";
import { parseQuery, teamRoute } from "@/server/http";
import { listActivity } from "@/server/services/activity/service";

/** GET /api/v1/teams/:teamId/activity?cursor&limit&type&entityType&actorId → Page<ActivityDTO> (PB-09). */
export const GET = teamRoute(async ({ req, params, user }) =>
  listActivity(params.teamId, user.id, parseQuery(req, listActivityQuery)),
);
