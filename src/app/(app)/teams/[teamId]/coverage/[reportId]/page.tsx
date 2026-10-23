import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteReportButton } from "@/components/features/coverage/delete-report-button";
import { formatCount, formatSeconds, PROVIDER_LABELS } from "@/components/features/coverage/format";
import { RequirementsTable } from "@/components/features/coverage/requirements-table";
import { ScoreRing } from "@/components/features/coverage/score-ring";
import { StatusCounts } from "@/components/features/coverage/status-badge";
import { formatClock, formatDayShort } from "@/components/features/meetings/format";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/page-header";
import { COVERAGE_STATUSES, WORK_TYPE_LABELS, type CoverageStatusValue } from "@/contracts/coverage";
import { AppError } from "@/server/errors";
import { requirePageUser } from "@/server/session";
import { getReport } from "@/server/services/coverage/service";

export const metadata = { title: "Coverage report" };

function TextSection({ label, text }: { label: string; text: string }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-900">
        {label} <span className="font-normal text-slate-500">({formatCount(text.length)} characters)</span>
      </summary>
      <div className="max-h-96 overflow-y-auto border-t border-slate-100 px-4 py-3 text-sm whitespace-pre-wrap text-slate-800">{text}</div>
    </details>
  );
}

/** PB-10 · FR-07 — one report: score, counts, requirement rows with evidence, and the PB-11 actions slot. */
export default async function CoverageReportPage({ params, searchParams }: PageProps<"/teams/[teamId]/coverage/[reportId]">) {
  const { teamId, reportId } = await params;
  const sp = await searchParams;
  const user = await requirePageUser();
  const report = await getReport(teamId, user.id, reportId).catch((err) => {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  });
  const filter = COVERAGE_STATUSES.includes(sp.status as CoverageStatusValue) ? (sp.status as CoverageStatusValue) : null;
  const created = new Date(report.createdAt);
  const when = `${formatDayShort(created, user.timezone)}, ${formatClock(created, user.timezone)}`;
  const provider = PROVIDER_LABELS[report.provider] ?? report.provider;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/teams/${teamId}/coverage`} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> Back to AI Coverage Check
      </Link>

      <SectionHeader
        title={report.title}
        description={
          <>
            {WORK_TYPE_LABELS[report.workType]} · Run by {report.author.name} · <time dateTime={report.createdAt}>{when}</time>
          </>
        }
        actions={report.canDelete ? <DeleteReportButton teamId={teamId} reportId={report.id} title={report.title} /> : null}
      />

      {report.status === "FAILED" ? (
        <Alert tone="danger">
          <p className="font-medium">This check didn&apos;t finish.</p>
          <p className="mt-1">
            {report.errorMessage ? `${report.errorMessage}. ` : ""}Nothing was lost, and this didn&apos;t produce any results. Your
            instructions and draft are below if you want to run the check again.
          </p>
        </Alert>
      ) : (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <ScoreRing score={report.score ?? 0} />
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <StatusCounts counts={report.counts} />
                <p className="text-xs text-slate-600">
                  Checked by {provider} · {report.model} · prompt {report.promptVersion} · {formatSeconds(report.latencyMs)}
                </p>
              </div>
            </CardBody>
          </Card>
          <p className="text-sm text-slate-600">
            AI can miss or invent gaps. Treat results as suggestions; StudyCrew never writes your assignment. Quotes marked “Not found in your
            draft” couldn&apos;t be matched word for word, so they count as Partial at most.
          </p>
          <RequirementsTable teamId={teamId} items={report.items} filter={filter} basePath={`/teams/${teamId}/coverage/${report.id}`} />
        </>
      )}

      <div className="flex flex-col gap-2">
        <TextSection label="Instructions" text={report.instructions} />
        <TextSection label="Draft" text={report.draft} />
      </div>
    </div>
  );
}
