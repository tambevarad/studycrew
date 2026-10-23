import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { WORK_TYPE_LABELS, type CoverageReportSummaryDTO } from "@/contracts/coverage";
import { StatusCounts } from "./status-badge";

export interface PastCheckRow extends CoverageReportSummaryDTO {
  /** Formatted on the server in the viewer's timezone (avoids hydration differences). */
  when: string;
}

/** The team's past checks, newest first. Server-rendered; the title links to the report. */
export function PastChecks({ teamId, reports }: { teamId: string; reports: PastCheckRow[] }) {
  return (
    <Card aria-labelledby="past-checks-heading">
      <CardHeader>
        <CardTitle id="past-checks-heading">Past checks</CardTitle>
      </CardHeader>
      {reports.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No checks yet"
            description="Paste the assignment and your draft above and run a check. Every report is shared with your team."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-5 py-2">
                  Title
                </th>
                <th scope="col" className="px-3 py-2">
                  Type
                </th>
                <th scope="col" className="px-3 py-2">
                  Score
                </th>
                <th scope="col" className="px-3 py-2">
                  Results
                </th>
                <th scope="col" className="px-3 py-2">
                  Run by
                </th>
                <th scope="col" className="px-5 py-2">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r) => (
                <tr key={r.id} className="relative hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    {/* The link's ::after covers the row, so the whole row is clickable but only one tab stop. */}
                    <Link href={`/teams/${teamId}/coverage/${r.id}`} className="text-brand-700 after:absolute after:inset-0 hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{WORK_TYPE_LABELS[r.workType]}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{r.score === null ? "—" : r.score}</td>
                  <td className="px-3 py-3">
                    {r.status === "FAILED" ? <Badge tone="danger">Didn&apos;t finish</Badge> : <StatusCounts counts={r.counts} />}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{r.author.name}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-700">
                    <time dateTime={r.createdAt}>{r.when}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
