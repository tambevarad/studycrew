import { applyTemplateInput } from "@/contracts/milestones";
import { created, parseBody, teamRoute } from "@/server/http";
import { applyTemplate } from "@/server/services/milestones/service";

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await applyTemplate(params.teamId, user.id, await parseBody(req, applyTemplateInput))),
);
