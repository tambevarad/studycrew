import { teamRoute } from "@/server/http";
import { deleteReport, getReport } from "@/server/services/coverage/service";

/** PB-10 — GET one report with its items, DELETE it permanently (author or leader). */
export const GET = teamRoute<{ reportId: string }>(async ({ params, user }) =>
  getReport(params.teamId, user.id, params.reportId),
);

export const DELETE = teamRoute<{ reportId: string }>(async ({ params, user }) =>
  deleteReport(params.teamId, user.id, params.reportId),
);
