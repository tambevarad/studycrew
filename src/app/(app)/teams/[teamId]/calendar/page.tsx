import {
  addDays,
  isValidDateKey,
  mondayOf,
  todayIn,
  zonedInstant,
} from "@/components/features/meetings/calendar-dates";
import { CalendarView } from "@/components/features/meetings/calendar-view";
import { requirePageUser } from "@/server/session";
import { getSuggestions, getWeekHeatmap, listMeetings } from "@/server/services/meetings/service";

export const metadata = { title: "Calendar" };

/** PB-06 · FR-03 — week calendar with the availability heatmap and best times. */
export default async function CalendarPage({ params, searchParams }: PageProps<"/teams/[teamId]/calendar">) {
  const { teamId } = await params;
  const sp = await searchParams;
  const user = await requirePageUser();
  const tz = user.timezone;

  const today = todayIn(tz);
  const thisWeekStart = mondayOf(today);
  const weekStart = typeof sp.week === "string" && isValidDateKey(sp.week) ? mondayOf(sp.week) : thisWeekStart;
  const weekEnd = addDays(weekStart, 6);

  const [meetings, heat] = await Promise.all([
    listMeetings(teamId, user.id, {
      from: zonedInstant(weekStart, 0, tz).toISOString(),
      to: zonedInstant(addDays(weekStart, 7), 0, tz).toISOString(),
    }),
    getWeekHeatmap(teamId, user.id, weekStart, tz),
  ]);

  const bestFrom = weekStart < today ? today : weekStart;
  const bestTimes =
    bestFrom <= weekEnd
      ? await getSuggestions(teamId, user.id, tz, {
          from: bestFrom,
          to: weekEnd,
          durationMinutes: 60,
          earliestHour: 8,
          latestHour: 22,
          limit: 3,
        })
      : [];

  return (
    <CalendarView
      teamId={teamId}
      timeZone={tz}
      today={today}
      weekStart={weekStart}
      thisWeekStart={thisWeekStart}
      meetings={meetings}
      cells={heat.cells}
      members={heat.members}
      missing={heat.missing}
      bestTimes={bestTimes}
      meId={user.id}
    />
  );
}
