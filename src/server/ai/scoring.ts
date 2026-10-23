import { COVERAGE_STATUSES, type CoverageStatusValue } from "@/contracts/coverage";

/** How many requirements have each status. Every status is present (0 when none). */
export function countByStatus(items: ReadonlyArray<{ status: CoverageStatusValue }>): Record<CoverageStatusValue, number> {
  const counts = Object.fromEntries(COVERAGE_STATUSES.map((s) => [s, 0])) as Record<CoverageStatusValue, number>;
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/** AC8: round((covered + 0.5 × partial) / n × 100); 0 when there are no items. */
export function scoreItems(items: ReadonlyArray<{ status: CoverageStatusValue }>): number {
  if (items.length === 0) return 0;
  const c = countByStatus(items);
  return Math.round(((c.COVERED + 0.5 * c.PARTIAL) / items.length) * 100);
}
