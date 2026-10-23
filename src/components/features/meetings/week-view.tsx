"use client";

import Link from "next/link";
import { DAY_LABELS, SLOTS_PER_DAY } from "@/contracts/availability";
import type { UserSummaryDTO } from "@/contracts/common";
import type { MeetingDTO } from "@/contracts/meetings";
import { cn } from "@/lib/utils";
import { addDays, parseDate, zonedParts } from "./calendar-dates";
import { formatDayLong, formatTimeRange } from "./format";

const ROW_PX = 22; // one half-hour row

interface Placed {
  meeting: MeetingDTO;
  day: number;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

/** Positions meetings on the 7-day grid in the viewer's zone; overlapping meetings share the column in lanes. */
function place(meetings: MeetingDTO[], weekStart: string, timeZone: string): Placed[] {
  const days: Placed[][] = Array.from({ length: 7 }, () => []);
  for (const m of meetings) {
    const s = zonedParts(new Date(m.startsAt), timeZone);
    const e = zonedParts(new Date(m.endsAt), timeZone);
    for (let day = 0; day < 7; day++) {
      const date = addDays(weekStart, day);
      if (date < s.date || date > e.date) continue;
      const startMin = date === s.date ? s.hours * 60 + s.minutes : 0;
      const endMin = date === e.date ? e.hours * 60 + e.minutes : 24 * 60;
      if (endMin > startMin) days[day].push({ meeting: m, day, startMin, endMin, lane: 0, lanes: 1 });
    }
  }
  for (const list of days) {
    list.sort((a, b) => a.startMin - b.startMin);
    const laneEnds: number[] = [];
    for (const p of list) {
      let lane = laneEnds.findIndex((end) => end <= p.startMin);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = p.endMin;
      p.lane = lane;
    }
    for (const p of list)
      p.lanes = Math.max(
        1,
        list.filter((o) => o.startMin < p.endMin && p.startMin < o.endMin).reduce((n, o) => Math.max(n, o.lane + 1), 1),
      );
  }
  return days.flat();
}

const RSVP_STYLE = {
  YES: "border-success-600 bg-success-50 text-success-700",
  MAYBE: "border-warning-600 bg-warning-50 text-warning-700",
  NO: "border-slate-300 bg-slate-50 text-slate-500 line-through",
  NONE: "border-brand-600 bg-brand-50 text-brand-800",
} as const;

const RSVP_WORD = { YES: "going", MAYBE: "maybe", NO: "can't make it" } as const;

const fmtHour = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`);

export function WeekView({
  weekStart,
  today,
  timeZone,
  meetings,
  cells,
  members,
  showHeatmap,
  firstHour,
  onSlotClick,
}: {
  weekStart: string;
  today: string;
  timeZone: string;
  meetings: MeetingDTO[];
  /** 336 viewer-zone cells: ids of members free then. */
  cells: string[][];
  members: UserSummaryDTO[];
  showHeatmap: boolean;
  firstHour: number;
  onSlotClick: (date: string, minute: number) => void;
}) {
  const firstHalf = firstHour * 2;
  const rows = SLOTS_PER_DAY - firstHalf;
  const total = Math.max(members.length, 1);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone";
  const placed = place(meetings, weekStart, timeZone);

  return (
    <div className="bg-surface overflow-x-auto rounded-lg border border-slate-200">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
        {/* Header row */}
        <div className="bg-surface sticky top-0 border-b border-slate-200" />
        {DAY_LABELS.map((label, day) => {
          const date = addDays(weekStart, day);
          const isToday = date === today;
          return (
            <div
              key={label}
              className={cn("border-b border-l border-slate-200 px-2 py-2 text-center", isToday && "bg-brand-50")}
            >
              <div className={cn("text-xs font-medium uppercase", isToday ? "text-brand-800" : "text-slate-600")}>
                {label}
              </div>
              <div className={cn("text-lg font-semibold", isToday ? "text-brand-800" : "text-slate-900")}>
                {parseDate(date).d}
              </div>
            </div>
          );
        })}

        {/* Hour gutter */}
        <div className="relative" style={{ height: rows * ROW_PX }} aria-hidden>
          {Array.from({ length: rows / 2 }, (_, i) => firstHour + i).map((h, i) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-slate-600"
              style={{ top: i * 2 * ROW_PX }}
            >
              {i === 0 ? "" : fmtHour(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAY_LABELS.map((label, day) => {
          const date = addDays(weekStart, day);
          return (
            <div key={label} className="relative border-l border-slate-200" style={{ height: rows * ROW_PX }}>
              {/* Background cells: heatmap + click to schedule (keyboard users use the New meeting button). */}
              <div aria-hidden>
                {Array.from({ length: rows }, (_, r) => {
                  const half = firstHalf + r;
                  const free = cells[day * SLOTS_PER_DAY + half] ?? [];
                  const share = free.length / total;
                  const minute = half * 30;
                  return (
                    <div
                      key={half}
                      onClick={() => onSlotClick(date, minute)}
                      title={
                        showHeatmap
                          ? `${fmtHour(Math.floor(half / 2))}${half % 2 ? ":30" : ""} · ${free.length} of ${members.length} free${free.length ? `: ${free.map(nameOf).join(", ")}` : ""}`
                          : undefined
                      }
                      className={cn(
                        "hover:outline-brand-500 cursor-pointer hover:outline hover:outline-1",
                        half % 2 === 0 ? "border-t border-slate-100" : "",
                      )}
                      style={{
                        height: ROW_PX,
                        backgroundColor:
                          showHeatmap && free.length > 0
                            ? `color-mix(in srgb, var(--color-success-600) ${Math.round(12 + share * 48)}%, transparent)`
                            : undefined,
                      }}
                    />
                  );
                })}
              </div>
              {/* Meetings */}
              {placed
                .filter((p) => p.day === day && p.endMin > firstHalf * 30)
                .map((p) => {
                  const top = ((Math.max(p.startMin, firstHalf * 30) - firstHalf * 30) / 30) * ROW_PX;
                  const height = Math.max(((p.endMin - Math.max(p.startMin, firstHalf * 30)) / 30) * ROW_PX - 2, 18);
                  const style = RSVP_STYLE[p.meeting.myRsvp ?? "NONE"];
                  const when = formatTimeRange(new Date(p.meeting.startsAt), new Date(p.meeting.endsAt), timeZone);
                  return (
                    <Link
                      key={`${p.meeting.id}-${day}`}
                      href={`/teams/${p.meeting.teamId}/calendar/${p.meeting.id}`}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-xs shadow-sm hover:shadow-md",
                        style,
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / p.lanes}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-semibold">{p.meeting.title}</span>
                      <span className="block truncate">{when}</span>
                      <span className="sr-only">
                        {`, ${formatDayLong(new Date(p.meeting.startsAt), timeZone)}, ${p.meeting.myRsvp ? `you answered ${RSVP_WORD[p.meeting.myRsvp]}` : "you haven't answered"}`}
                      </span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
