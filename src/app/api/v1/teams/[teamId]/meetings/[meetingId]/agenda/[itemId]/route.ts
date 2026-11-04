import { teamRoute } from "@/server/http";
import { deleteAgendaItem } from "@/server/services/agenda/service";

/** PB-15 — DELETE a topic (the person who added it or a leader). */
export const DELETE = teamRoute<{ meetingId: string; itemId: string }>(async ({ params, user }) =>
  deleteAgendaItem(params.teamId, user.id, params.meetingId, params.itemId),
);
