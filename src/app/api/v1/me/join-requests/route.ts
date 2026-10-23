import { authedRoute } from "@/server/http";
import { listMyJoinRequests } from "@/server/services/teams/service";

export const GET = authedRoute(async ({ user }) => listMyJoinRequests(user.id));
