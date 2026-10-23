import { teamRoute } from "@/server/http";
import { listJoinRequests } from "@/server/services/teams/service";

export const GET = teamRoute(async ({ params, user }) => listJoinRequests(params.teamId, user.id), { leaderOnly: true });
