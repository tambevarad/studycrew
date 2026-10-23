import { createResourceInput, listResourcesQuery } from "@/contracts/resources";
import { created, parseBody, parseQuery, teamRoute } from "@/server/http";
import { createResource, listResources } from "@/server/services/resources/service";

/** PB-07 — GET list (pinned first, newest first), POST create. */
export const GET = teamRoute(async ({ req, params, user }) =>
  listResources(params.teamId, user.id, parseQuery(req, listResourcesQuery)),
);

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await createResource(params.teamId, user.id, await parseBody(req, createResourceInput))),
);
