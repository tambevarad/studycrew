import Link from "next/link";
import type { MeetingDTO } from "@/contracts/meetings";
import { cn } from "@/lib/utils";
import { mondayOf, parseDate, zonedParts } from "./calendar-dates";
import { formatClock, monthShort } from "./format";

const WEEKDAYS = [
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
  ["Sun", "Sunday"],
] as const;
const SHOWN_PER_DAY = 3;

/**
 * PB-06b month grid: one row per week, meetings listed under their day in the viewer's zone. A day number opens that
 * week; "+N more" does the same when a day has more meetings than fit. Pure rendering, no client state.
 */
export function MonthView({
  teamId,
  month,
  days,
  today,
  timeZone,
  meetings,
}: {
  teamId: string;
  month: string;
  days: string[];
  today: string;
  timeZone: string;
  meetings: MeetingDTO[];
}) {
  const base = `/teams/${teamId}/calendar`;
  const byDay = new Map<string, MeetingDTO[]>();
  for (const m of meetings) {
    const day = zonedParts(new Date(m.startsAt), timeZone).date;
    byDay.set(day, [...(byDay.get(day) ?? []), m]);
  }
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="bg-surface overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[42rem] table-fixed border-collapse text-sm" aria-describedby="calendar-period">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map(([short, long]) => (
              <th
                key={short}
                scope="col"
                className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase"
              >
                <abbr title={long} className="no-underline">
                  {short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]} className="border-b border-slate-100 last:border-b-0">
              {week.map((day) => {
                const { m, d } = parseDate(day);
                const inMonth = day.startsWith(month);
                const isToday = day === today;
                const list = byDay.get(day) ?? [];
                const more = list.length - SHOWN_PER_DAY;
                const weekHref = `${base}?week=${mondayOf(day)}`;
                return (
                  <td
                    key={day}
                    className={cn(
                      "h-28 border-r border-slate-100 p-1.5 align-top last:border-r-0",
                      !inMonth && "bg-slate-50/70",
                      isToday && "bg-brand-50",
                    )}
                  >
                    <Link
                      href={weekHref}
                      scroll={false}
                      aria-label={`${monthShort(m)} ${d}${isToday ? ", today" : ""}${list.length ? `, ${list.length} ${list.length === 1 ? "meeting" : "meetings"}` : ""}. Show that week`}
                      className={cn(
                        "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-semibold whitespace-nowrap hover:bg-slate-200",
                        isToday
                          ? "bg-brand-600 hover:bg-brand-700 text-white"
                          : inMonth
                            ? "text-slate-900"
                            : "text-slate-500",
                      )}
                    >
                      {d === 1 ? `${monthShort(m)} 1` : d}
                    </Link>
                    {list.length > 0 ? (
                      <ul className="mt-1 flex flex-col gap-1">
                        {list.slice(0, SHOWN_PER_DAY).map((mt) => (
                          <li key={mt.id}>
                            <Link
                              href={`${base}/${mt.id}`}
                              className="bg-brand-50 text-brand-800 hover:bg-brand-100 block truncate rounded px-1.5 py-0.5 text-xs"
                              title={`${formatClock(new Date(mt.startsAt), timeZone)} ${mt.title}`}
                            >
                              <span className="font-medium">{formatClock(new Date(mt.startsAt), timeZone)}</span>{" "}
                              {mt.title}
                            </Link>
                          </li>
                        ))}
                        {more > 0 ? (
                          <li>
                            <Link
                              href={weekHref}
                              scroll={false}
                              className="text-brand-700 px-1.5 text-xs font-medium hover:underline"
                            >
                              +{more} more
                            </Link>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
