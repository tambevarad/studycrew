import { helpFlagInput } from "@/contracts/agenda";
import { parseBody, teamRoute } from "@/server/http";
import { setHelpFlag } from "@/server/services/agenda/service";

/** PB-15 — PUT the caller's "I need help" flag on a topic (idempotent). */
export const PUT = teamRoute<{ meetingId: string; itemId: string }>(async ({ req, params, user }) =>
  setHelpFlag(params.teamId, user.id, params.meetingId, params.itemId, await parseBody(req, helpFlagInput)),
);
