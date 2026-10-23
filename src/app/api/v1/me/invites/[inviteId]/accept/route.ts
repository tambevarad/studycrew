import { authedRoute } from "@/server/http";
import { acceptInvite } from "@/server/services/teams/service";

export const POST = authedRoute<{ inviteId: string }>(async ({ params, user }) => acceptInvite(params.inviteId, user.id));
