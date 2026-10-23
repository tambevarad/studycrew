import Link from "next/link";
import { CoverageItemActions } from "@/components/features/coverage-actions/coverage-item-actions";
import { EmptyState } from "@/components/ui/empty-state";
import type { CoverageItemDTO, CoverageStatusValue } from "@/contracts/coverage";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_ORDER } from "./format";
import { StatusBadge } from "./status-badge";

/**
 * The report's requirement rows. Server-rendered; the status filter is a set of links (?status=…) like the
 * other list filters in the app. Default view: every item, Missing first, then Partial, then Covered.
 */
export function RequirementsTable({
  teamId,
  items,
  filter,
  basePath,
}: {
  teamId: string;
  items: CoverageItemDTO[];
  filter: CoverageStatusValue | null;
  basePath: string;
}) {
  const sorted = [...items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.position - b.position);
  const shown = filter ? sorted.filter((i) => i.status === filter) : sorted;
  const chips: Array<{ value: CoverageStatusValue | null; label: string; count: number }> = [
    { value: null, label: "All", count: items.length },
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s], count: items.filter((i) => i.status === s).length })),
  ];

  return (
    <section aria-labelledby="requirements-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="requirements-heading" className="text-base font-semibold text-slate-900">
          Requirements
        </h3>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <Link
              key={c.label}
              href={c.value ? `${basePath}?status=${c.value}` : basePath}
              scroll={false}
              aria-current={filter === c.value ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                filter === c.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {c.label} ({c.count})
            </Link>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={filter ? `No ${STATUS_LABELS[filter].toLowerCase()} requirements` : "No requirements"}
          description={filter ? "Nothing in this report has that status. Choose another filter." : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface">
          <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-28" />
              <col className="w-[27%]" />
              <col className="w-[31%]" />
              <col />
              {/* PB-11 fills this slot ("Create task", helpful / not helpful). */}
              <col className="w-28" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Status
                </th>
                <th scope="col" className="px-3 py-2">
                  Requirement
                </th>
                <th scope="col" className="px-3 py-2">
                  Evidence from your draft
                </th>
                <th scope="col" className="px-3 py-2">
                  Next step
                </th>
                <th scope="col" className="px-4 py-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {shown.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{item.requirement}</p>
                    <p className="mt-1 text-slate-600">{item.reason}</p>
                  </td>
                  <td className="px-3 py-3">
                    {item.evidenceQuote ? (
                      <>
                        <blockquote className="border-l-2 border-slate-300 pl-3 break-words text-slate-800 italic">
                          “{item.evidenceQuote}”
                        </blockquote>
                        {item.evidenceVerified ? (
                          <p className="mt-1 text-xs font-medium text-success-700">
                            <span aria-hidden>✓ </span>Found in your draft
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-medium text-warning-700">
                            <span aria-hidden>⚠ </span>Not found in your draft
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-500">No matching text in the draft.</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-800">{item.suggestion ?? <span className="text-slate-500">Nothing to add.</span>}</td>
                  <td className="px-4 py-3">
                    <CoverageItemActions teamId={teamId} item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
