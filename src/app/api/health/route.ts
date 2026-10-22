import { checkDatabase } from "@/server/health";

/** Uptime monitor target (NFR-05). 200 when the app and database respond. */
export async function GET() {
  const dbCheck = await checkDatabase();
  if (!dbCheck.ok) return Response.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  return Response.json({
    status: "ok",
    db: "ok",
    latencyMs: dbCheck.latencyMs,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  });
}
