import { updateResourceInput } from "@/contracts/resources";
import { parseBody, teamRoute } from "@/server/http";
import { deleteResource, updateResource } from "@/server/services/resources/service";

/** PB-07 — PATCH edit or pin, DELETE remove (creator or leader). */
export const PATCH = teamRoute<{ resourceId: string }>(async ({ req, params, user }) =>
  updateResource(params.teamId, user.id, params.resourceId, await parseBody(req, updateResourceInput)),
);

export const DELETE = teamRoute<{ resourceId: string }>(async ({ params, user }) =>
  deleteResource(params.teamId, user.id, params.resourceId),
);
