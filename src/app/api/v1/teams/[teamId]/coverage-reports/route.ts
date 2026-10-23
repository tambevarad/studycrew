import { runCoverageInput } from "@/contracts/coverage";
import { created, parseBody, teamRoute } from "@/server/http";
import { listReports, runCoverageCheck } from "@/server/services/coverage/service";

/** Two model calls with a 30 s budget; Vercel's default function limit is shorter. */
export const maxDuration = 60;

/** PB-10 — GET past checks (newest first), POST run a check (consent required; 429 over the daily limit; 502 on AI failure). */
export const GET = teamRoute(async ({ params, user }) => listReports(params.teamId, user.id));

export const POST = teamRoute(async ({ req, params, user }) =>
  created(await runCoverageCheck(params.teamId, user.id, await parseBody(req, runCoverageInput))),
);
