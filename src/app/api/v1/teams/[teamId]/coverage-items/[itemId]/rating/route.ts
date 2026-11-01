import { rateItemInput } from "@/contracts/coverage";
import { parseBody, teamRoute } from "@/server/http";
import { rateItem } from "@/server/services/coverage-actions/service";

export const PUT = teamRoute<{ teamId: string; itemId: string }>(async ({ req, params, user }) =>
  rateItem(params.teamId, user.id, params.itemId, await parseBody(req, rateItemInput)),
);
