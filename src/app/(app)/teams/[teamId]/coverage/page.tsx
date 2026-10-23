import { NewCheckForm } from "@/components/features/coverage/new-check-form";
import { PastChecks } from "@/components/features/coverage/past-checks";
import { formatClock, formatDayShort } from "@/components/features/meetings/format";
import { SectionHeader } from "@/components/ui/page-header";
import { requirePageUser } from "@/server/session";
import { activeProvider, listReports, remainingRunsToday } from "@/server/services/coverage/service";

export const metadata = { title: "AI Coverage Check" };

/** PB-10 · FR-07 — run a new check and see the team's past checks. */
export default async function CoveragePage({ params }: PageProps<"/teams/[teamId]/coverage">) {
  const { teamId } = await params;
  const user = await requirePageUser();
  const [reports, remaining] = await Promise.all([listReports(teamId, user.id), remainingRunsToday(teamId, user.id)]);
  const rows = reports.map((r) => {
    const d = new Date(r.createdAt);
    return { ...r, when: `${formatDayShort(d, user.timezone)}, ${formatClock(d, user.timezone)}` };
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="AI Coverage Check" description="Compare the assignment with your draft and find what's missing — before you submit." />
      <NewCheckForm teamId={teamId} remaining={remaining} provider={activeProvider().provider} />
      <PastChecks teamId={teamId} reports={rows} />
    </div>
  );
}
