import type { UserSummaryDTO } from "@/contracts/common";
import type { MeetingSuggestionDTO } from "@/contracts/meetings";

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
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(
    new Date(suggestion.startsAt),
  );
  const range = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).formatRange(
    new Date(suggestion.startsAt),
    new Date(suggestion.endsAt),
  );
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
