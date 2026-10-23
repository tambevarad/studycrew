import { authedRoute } from "@/server/http";
import { listMyInvites } from "@/server/services/teams/service";

export const GET = authedRoute(async ({ user }) => listMyInvites(user.id));
