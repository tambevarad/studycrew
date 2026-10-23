import { updateMeetingInput } from "@/contracts/meetings";
import { parseBody, teamRoute } from "@/server/http";
import { deleteMeeting, getMeeting, updateMeeting } from "@/server/services/meetings/service";

/** PB-06 — one meeting. PATCH/DELETE: organizer or leader. */
export const GET = teamRoute<{ meetingId: string }>(async ({ params, user }) =>
  getMeeting(params.teamId, user.id, params.meetingId),
);

export const PATCH = teamRoute<{ meetingId: string }>(async ({ req, params, user }) =>
  updateMeeting(params.teamId, user.id, params.meetingId, await parseBody(req, updateMeetingInput)),
);

export const DELETE = teamRoute<{ meetingId: string }>(async ({ params, user }) =>
  deleteMeeting(params.teamId, user.id, params.meetingId),
);
