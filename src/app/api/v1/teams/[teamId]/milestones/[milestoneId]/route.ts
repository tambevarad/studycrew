import { updateMilestoneInput } from "@/contracts/milestones";
import { parseBody, teamRoute } from "@/server/http";
import { deleteMilestone, updateMilestone } from "@/server/services/milestones/service";

type P = { teamId: string; milestoneId: string };

export const PATCH = teamRoute<P>(async ({ req, params, user }) =>
  updateMilestone(params.teamId, user.id, params.milestoneId, await parseBody(req, updateMilestoneInput)),
);

export const DELETE = teamRoute<P>(async ({ params, user }) =>
  deleteMilestone(params.teamId, user.id, params.milestoneId),
);
