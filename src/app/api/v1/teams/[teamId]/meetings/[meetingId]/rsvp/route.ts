import { rsvpInput } from "@/contracts/meetings";
import { parseBody, teamRoute } from "@/server/http";
import { setRsvp } from "@/server/services/meetings/service";

/** PB-06 — PUT my RSVP (idempotent). */
export const PUT = teamRoute<{ meetingId: string }>(async ({ req, params, user }) =>
  setRsvp(params.teamId, user.id, params.meetingId, await parseBody(req, rsvpInput)),
);
