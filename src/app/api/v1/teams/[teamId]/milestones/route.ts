import { createMilestoneInput } from "@/contracts/milestones";
import { created, parseBody, teamRoute } from "@/server/http";
import { createMilestone, listMilestones } from "@/server/services/milestones/service";

export const GET = teamRoute(async ({ params, user }) => listMilestones(params.teamId, user.id));

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await createMilestone(params.teamId, user.id, await parseBody(req, createMilestoneInput))),
);
