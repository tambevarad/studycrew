import { teamRoute } from "@/server/http";
import { getTeamDashboard } from "@/server/services/dashboard/service";

/** PB-12 — GET the team dashboard (members only; `teamRoute` returns 403 to anyone else). */
export const GET = teamRoute(async ({ params, user }) => getTeamDashboard(params.teamId, user.id));
