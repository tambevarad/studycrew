import { teamRoute } from "@/server/http";
import { rotateInviteCode } from "@/server/services/teams/service";

export const POST = teamRoute(async ({ params, user }) => rotateInviteCode(params.teamId, user.id), { leaderOnly: true });
