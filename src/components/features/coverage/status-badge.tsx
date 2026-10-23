import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CoverageStatusValue } from "@/contracts/coverage";
import { STATUS_LABELS, STATUS_TONES } from "./format";

const ICONS = { COVERED: CircleCheck, PARTIAL: CircleDashed, MISSING: CircleAlert } as const;

/** AC10: status is shown with text and an icon, never color alone. */
export function StatusBadge({ status, count }: { status: CoverageStatusValue; count?: number }) {
  const Icon = ICONS[status];
  return (
    <Badge tone={STATUS_TONES[status]}>
      <Icon className="size-3.5" aria-hidden />
      {count === undefined ? STATUS_LABELS[status] : `${count} ${STATUS_LABELS[status].toLowerCase()}`}
    </Badge>
  );
}

export function StatusCounts({ counts }: { counts: Record<CoverageStatusValue, number> }) {
  return (
    <span className="flex flex-wrap gap-1">
      <StatusBadge status="COVERED" count={counts.COVERED} />
      <StatusBadge status="PARTIAL" count={counts.PARTIAL} />
      <StatusBadge status="MISSING" count={counts.MISSING} />
    </span>
  );
}
