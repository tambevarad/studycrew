import { createTaskInput, listTasksQuery } from "@/contracts/tasks";
import { created, parseBody, parseQuery, teamRoute } from "@/server/http";
import { createTask, listTasks } from "@/server/services/tasks/service";

export const GET = teamRoute(async ({ req, params, user }) =>
  listTasks(params.teamId, user.id, parseQuery(req, listTasksQuery)),
);

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await createTask(params.teamId, user.id, await parseBody(req, createTaskInput))),
);
