import { teamRoute } from "@/server/http";
import { getTeamAvailabilityFor } from "@/server/services/availability/service";

export const GET = teamRoute(async ({ params, user }) => getTeamAvailabilityFor(params.teamId, user.id));
