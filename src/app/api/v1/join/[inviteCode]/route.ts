import { authedRoute } from "@/server/http";
import { joinByCode } from "@/server/services/teams/service";

/** Outside teams/[teamId] on purpose: the caller isn't a member yet (api.md § PB-04). */
export const POST = authedRoute<{ inviteCode: string }>(async ({ params, user }) => joinByCode(params.inviteCode, user.id));
