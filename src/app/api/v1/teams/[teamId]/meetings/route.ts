import { createMeetingInput, listMeetingsQuery } from "@/contracts/meetings";
import { created, parseBody, parseQuery, teamRoute } from "@/server/http";
import { createMeeting, listMeetings } from "@/server/services/meetings/service";

/** PB-06 — GET meetings overlapping [from, to); POST schedule a meeting. */
export const GET = teamRoute(async ({ req, params, user }) =>
  listMeetings(params.teamId, user.id, parseQuery(req, listMeetingsQuery)),
);

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await createMeeting(params.teamId, user.id, await parseBody(req, createMeetingInput))),
);
