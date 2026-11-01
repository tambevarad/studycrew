import { linkTaskInput } from "@/contracts/milestones";
import { parseBody, teamRoute } from "@/server/http";
import { linkTask } from "@/server/services/milestones/service";

export const POST = teamRoute<{ teamId: string; milestoneId: string }>(async ({ req, params, user }) => {
  const { taskId } = await parseBody(req, linkTaskInput);
  return linkTask(params.teamId, user.id, params.milestoneId, taskId);
});
