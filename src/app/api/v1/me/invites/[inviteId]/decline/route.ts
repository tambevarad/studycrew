import { authedRoute } from "@/server/http";
import { declineInvite } from "@/server/services/teams/service";

export const POST = authedRoute<{ inviteId: string }>(async ({ params, user }) => declineInvite(params.inviteId, user.id));
