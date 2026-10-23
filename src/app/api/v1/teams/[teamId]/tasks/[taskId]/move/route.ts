import { moveTaskInput } from "@/contracts/tasks";
import { parseBody, teamRoute } from "@/server/http";
import { moveTask } from "@/server/services/tasks/service";

export const POST = teamRoute<{ teamId: string; taskId: string }>(async ({ req, params, user }) =>
  moveTask(params.teamId, user.id, params.taskId, await parseBody(req, moveTaskInput)),
);
