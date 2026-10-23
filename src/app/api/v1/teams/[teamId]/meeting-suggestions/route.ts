import { meetingSuggestionsQuery } from "@/contracts/meetings";
import { parseQuery, teamRoute } from "@/server/http";
import { getSuggestions } from "@/server/services/meetings/service";

/** PB-06 — ranked meeting times. Dates and hours are in the caller's time zone (from their profile). */
export const GET = teamRoute(async ({ req, params, user }) =>
  getSuggestions(params.teamId, user.id, user.timezone, parseQuery(req, meetingSuggestionsQuery)),
);
