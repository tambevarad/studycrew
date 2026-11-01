import { createTaskFromItemInput } from "@/contracts/coverage";
import { created, parseBody, teamRoute } from "@/server/http";
import { createTaskFromItem } from "@/server/services/coverage-actions/service";

export const POST = teamRoute<{ teamId: string; itemId: string }>(async ({ req, params, user }) =>
  created(
    await createTaskFromItem(params.teamId, user.id, params.itemId, await parseBody(req, createTaskFromItemInput)),
  ),
);
