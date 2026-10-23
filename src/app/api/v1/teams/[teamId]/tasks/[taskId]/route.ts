import { updateTaskInput } from "@/contracts/tasks";
import { parseBody, teamRoute } from "@/server/http";
import { deleteTask, getTask, updateTask } from "@/server/services/tasks/service";

type P = { teamId: string; taskId: string };

export const GET = teamRoute<P>(async ({ params, user }) => getTask(params.teamId, user.id, params.taskId));

export const PATCH = teamRoute<P>(async ({ req, params, user }) =>
  updateTask(params.teamId, user.id, params.taskId, await parseBody(req, updateTaskInput)),
);

export const DELETE = teamRoute<P>(async ({ params, user }) => deleteTask(params.teamId, user.id, params.taskId));
