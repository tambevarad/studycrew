import { createAgendaItemInput } from "@/contracts/agenda";
import { created, parseBody, teamRoute } from "@/server/http";
import { addAgendaItem, listAgenda } from "@/server/services/agenda/service";

type P = { meetingId: string };

/** PB-15 — GET topics (most-flagged first), POST add a topic. */
export const GET = teamRoute<P>(async ({ params, user }) => listAgenda(params.teamId, user.id, params.meetingId));

export const POST = teamRoute<P>(async ({ req, params, user }) =>
  created(await addAgendaItem(params.teamId, user.id, params.meetingId, await parseBody(req, createAgendaItemInput))),
);
