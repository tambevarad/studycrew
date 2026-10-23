"use client";

import { CalendarSearch, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/page-header";
import type { UserSummaryDTO } from "@/contracts/common";
import type { MeetingDTO, MeetingSuggestionDTO } from "@/contracts/meetings";
import { addDays, parseDate, zonedParts } from "./calendar-dates";
import { FindTimeDialog } from "./find-time-dialog";
import { monthShort } from "./format";
import { MeetingFormDialog, type MeetingDraft } from "./meeting-form-dialog";
import { SuggestionText } from "./suggestion-text";
import { WeekView } from "./week-view";

function draftFromSuggestion(s: MeetingSuggestionDTO, timeZone: string): MeetingDraft {
  const a = zonedParts(new Date(s.startsAt), timeZone);
  const b = zonedParts(new Date(s.endsAt), timeZone);
  return {
    date: a.date,
    startMinute: a.hours * 60 + a.minutes,
    endMinute: b.date === a.date ? b.hours * 60 + b.minutes : 24 * 60,
  };
}

function weekLabel(weekStart: string): string {
  const a = parseDate(weekStart);
  const b = parseDate(addDays(weekStart, 6));
  const month = monthShort;
  return a.m === b.m ? `${month(a.m)} ${a.d} – ${b.d}, ${b.y}` : `${month(a.m)} ${a.d} – ${month(b.m)} ${b.d}, ${b.y}`;
}

export function CalendarView({
  teamId,
  timeZone,
  today,
  weekStart,
  thisWeekStart,
  meetings,
  cells,
  members,
  missing,
  bestTimes,
  meId,
}: {
  teamId: string;
  timeZone: string;
  today: string;
  weekStart: string;
  thisWeekStart: string;
  meetings: MeetingDTO[];
  cells: string[][];
  members: UserSummaryDTO[];
  missing: UserSummaryDTO[];
  bestTimes: MeetingSuggestionDTO[];
  meId: string;
}) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [earlyHours, setEarlyHours] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [draft, setDraft] = useState<MeetingDraft | null>(null);
  const base = `/teams/${teamId}/calendar`;
  const iAmMissing = missing.some((m) => m.id === meId);

  const newDefault = (): MeetingDraft => ({
    date: today < weekStart ? weekStart : today,
    startMinute: 19 * 60,
    endMinute: 20 * 60,
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Calendar"
        description={`Meetings and when everyone is free. Times are in your time zone (${timeZone}).`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setFindOpen(true)}>
              <CalendarSearch aria-hidden /> Find a time
            </Button>
            <Button onClick={() => setDraft(newDefault())}>
              <Plus aria-hidden /> New meeting
            </Button>
          </>
        }
      />

      {missing.length > 0 ? (
        <Alert tone="warning" className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {missing.length === 1
              ? `${missing[0].name} hasn't`
              : `${missing.map((m) => m.name.split(" ")[0]).join(", ")} haven't`}{" "}
            added weekly availability yet, so suggestions can&apos;t include them.
          </span>
          {iAmMissing ? (
            <LinkButton href="/availability" size="sm" variant="secondary">
              Add mine
            </LinkButton>
          ) : null}
        </Alert>
      ) : null}

      <section aria-labelledby="best-times" className="bg-surface rounded-lg border border-slate-200 p-4">
        <h3 id="best-times" className="text-sm font-semibold text-slate-900">
          Best times {weekStart === thisWeekStart ? "this week" : "that week"}
        </h3>
        {bestTimes.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">
            No shared free time left in this week. Try “Find a time” for other days.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {bestTimes.map((s) => (
              <li key={s.startsAt} className="flex items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <SuggestionText suggestion={s} timeZone={timeZone} members={members} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={s.availableCount === s.totalMembers ? "success" : "warning"}>
                    {s.availableCount}/{s.totalMembers}
                  </Badge>
                  <button
                    type="button"
                    className="text-brand-700 text-xs font-medium hover:underline"
                    onClick={() => setDraft(draftFromSuggestion(s, timeZone))}
                  >
                    Schedule
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LinkButton
            href={`${base}?week=${addDays(weekStart, -7)}`}
            variant="outline"
            size="icon"
            aria-label="Previous week"
            scroll={false}
          >
            <ChevronLeft aria-hidden />
          </LinkButton>
          <LinkButton
            href={`${base}?week=${addDays(weekStart, 7)}`}
            variant="outline"
            size="icon"
            aria-label="Next week"
            scroll={false}
          >
            <ChevronRight aria-hidden />
          </LinkButton>
          {weekStart !== thisWeekStart ? (
            <Link href={base} className="text-brand-700 text-sm font-medium hover:underline" scroll={false}>
              This week
            </Link>
          ) : null}
          <h3 className="ml-1 text-base font-semibold text-slate-900" aria-live="polite">
            {weekLabel(weekStart)}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="accent-brand-600 size-4"
            />
            Show who&apos;s free
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={earlyHours}
              onChange={(e) => setEarlyHours(e.target.checked)}
              className="accent-brand-600 size-4"
            />
            Show early hours
          </label>
        </div>
      </div>

      {showHeatmap ? (
        <p className="-mt-2 flex items-center gap-2 text-xs text-slate-600">
          <span>Fewer free</span>
          {[0.15, 0.4, 0.65, 1].map((s) => (
            <span
              key={s}
              className="inline-block size-3 rounded-sm"
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-success-600) ${Math.round(12 + s * 48)}%, transparent)`,
              }}
              aria-hidden
            />
          ))}
          <span>Everyone free · Click an empty spot to schedule there</span>
        </p>
      ) : null}

      <WeekView
        weekStart={weekStart}
        today={today}
        timeZone={timeZone}
        meetings={meetings}
        cells={cells}
        members={members}
        showHeatmap={showHeatmap}
        firstHour={earlyHours ? 0 : 7}
        onSlotClick={(date, minute) =>
          setDraft({ date, startMinute: minute, endMinute: Math.min(minute + 60, 24 * 60) })
        }
      />

      {meetings.length === 0 ? (
        <p className="text-sm text-slate-600">
          No meetings this week yet. Use “Find a time” to pick one everyone can make.
        </p>
      ) : null}

      {findOpen ? (
        <FindTimeDialog
          teamId={teamId}
          timeZone={timeZone}
          today={today}
          members={members}
          open
          onClose={() => setFindOpen(false)}
          onPick={(s) => {
            setFindOpen(false);
            setDraft(draftFromSuggestion(s, timeZone));
          }}
        />
      ) : null}
      {draft ? (
        <MeetingFormDialog
          key={`${draft.date}-${draft.startMinute}`}
          teamId={teamId}
          timeZone={timeZone}
          open
          onClose={() => setDraft(null)}
          draft={draft}
        />
      ) : null}
    </div>
  );
}
