import type { UserSummaryDTO } from "@/contracts/common";
import type { MeetingSuggestionDTO } from "@/contracts/meetings";
import { formatDayShort, formatTimeRange } from "./format";

/** "Thu, Oct 29 · 7:00 – 8:00 PM" + who can't make it. */
export function SuggestionText({
  suggestion,
  timeZone,
  members,
}: {
  suggestion: MeetingSuggestionDTO;
  timeZone: string;
  members: UserSummaryDTO[];
}) {
  const day = formatDayShort(new Date(suggestion.startsAt), timeZone);
  const range = formatTimeRange(new Date(suggestion.startsAt), new Date(suggestion.endsAt), timeZone);
  const missing = suggestion.unavailableUserIds.map(
    (id) => members.find((m) => m.id === id)?.name.split(" ")[0] ?? "someone",
  );
  return (
    <>
      <p className="text-sm font-medium text-slate-900">
        {day} · {range}
      </p>
      <p className="text-xs text-slate-600">
        {missing.length === 0 ? "Everyone is free" : `Not free: ${missing.join(", ")}`}
      </p>
    </>
  );
}
