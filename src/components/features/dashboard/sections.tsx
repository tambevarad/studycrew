/**
 * PB-12 dashboard building blocks (Server Components: dates are formatted once, on the server, so there is nothing to
 * hydrate). Used by the team overview (`/teams/[teamId]`) and the personal home (`/dashboard`).
 */
import { CalendarDays, CalendarClock, Flag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { MeetingDTO } from "@/contracts/meetings";
import type { MilestoneDTO } from "@/contracts/milestones";
import type { TaskDTO } from "@/contracts/tasks";
import { AvatarStack } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { dueLabel } from "@/lib/dates";
import { cn, pluralize } from "@/lib/utils";
import { formatDayShort, formatTimeRange, zoneAbbreviation } from "@/components/features/meetings/format";

export const boardTaskHref = (teamId: string, taskId: string) => `/teams/${teamId}/board?task=${taskId}`;

/**
 * A titled card; `id` names its heading so the section is labelled for screen readers. `level` keeps the heading order
 * right: h3 under the team overview's h2, h2 directly under the personal home's h1.
 */
export function Panel({
  id,
  title,
  level = 3,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  level?: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Card aria-labelledby={id} className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <Heading id={id} className="text-base font-semibold text-slate-900">
          {title}
        </Heading>
        {action}
      </div>
      <div className="flex-1 px-5 py-4">{children}</div>
    </Card>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone = "neutral",
  testId,
  children,
}: {
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "danger";
  testId: string;
  children?: ReactNode;
}) {
  // No accessible name on the tile's <section>: a named section is a landmark region, and four of them would crowd
  // the screen reader's landmark list. The visible label already says what the tile is.
  return (
    <Card data-testid={testId} className="flex items-center gap-4 p-4">
      {children}
      <div className="min-w-0">
        <p className="text-sm text-slate-600">{label}</p>
        {value !== undefined ? (
          <p className={cn("text-3xl font-semibold", tone === "danger" ? "text-danger-700" : "text-slate-900")}>
            {value}
          </p>
        ) : null}
        {detail ? <div className="mt-0.5 text-sm text-slate-700">{detail}</div> : null}
      </div>
    </Card>
  );
}

const DUE_TONE = { overdue: "text-danger-700", soon: "text-warning-700", later: "text-slate-600" } as const;

function dueTone(task: TaskDTO, now: Date): keyof typeof DUE_TONE {
  if (task.isOverdue) return "overdue";
  if (task.dueAt && Date.parse(task.dueAt) - now.getTime() <= 24 * 3_600_000) return "soon";
  return "later";
}

/** Tasks as links to their card on the board; the due text says "Overdue by …" / "Due in …", never colour alone. */
export function TaskLinks({
  tasks,
  now,
  timeZone,
  empty,
  teamNames,
}: {
  tasks: TaskDTO[];
  now: Date;
  timeZone: string;
  empty: ReactNode;
  /** Show which team each task belongs to (personal home). */
  teamNames?: Map<string, string>;
}) {
  if (tasks.length === 0) return <p className="text-sm text-slate-600">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <Link href={boardTaskHref(t.teamId, t.id)} className="text-brand-700 font-medium hover:underline">
              {t.title}
            </Link>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
              {teamNames ? <span>{teamNames.get(t.teamId) ?? "Team"}</span> : null}
              {t.dueAt ? (
                <span className={cn("inline-flex items-center gap-1 font-medium", DUE_TONE[dueTone(t, now)])}>
                  <CalendarClock aria-hidden className="size-3.5" />
                  {dueLabel(t.dueAt, now, timeZone)}
                </span>
              ) : (
                <span>No due date</span>
              )}
            </p>
          </div>
          {t.assignees.length > 0 ? <AvatarStack names={t.assignees.map((a) => a.name)} max={3} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function MeetingLinks({
  meetings,
  timeZone,
  empty,
  teamNames,
}: {
  meetings: MeetingDTO[];
  timeZone: string;
  empty: ReactNode;
  teamNames?: Map<string, string>;
}) {
  if (meetings.length === 0) return <p className="text-sm text-slate-600">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {meetings.map((m) => {
        const start = new Date(m.startsAt);
        return (
          <li key={m.id} className="flex items-start gap-3">
            <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <Link href={`/teams/${m.teamId}/calendar/${m.id}`} className="text-brand-700 font-medium hover:underline">
                {m.title}
              </Link>
              <p className="text-xs text-slate-600">
                {teamNames ? `${teamNames.get(m.teamId) ?? "Team"} · ` : null}
                {formatDayShort(start, timeZone)} · {formatTimeRange(start, new Date(m.endsAt), timeZone)}{" "}
                {zoneAbbreviation(start, timeZone)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MilestoneProgress({ milestones, timeZone }: { milestones: MilestoneDTO[]; timeZone: string }) {
  return (
    <ul className="flex flex-col gap-4">
      {milestones.map((m) => (
        <li key={m.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-900">
              <Flag aria-hidden className="size-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{m.title}</span>
            </span>
            <span className="shrink-0 text-slate-700">
              {m.percent}%{" "}
              <span className="text-slate-600">
                ({m.doneCount} of {pluralize(m.taskCount, "task")})
              </span>
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress of “${m.title}”`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={m.percent}
            aria-valuetext={`${m.percent}% (${m.doneCount} of ${m.taskCount} tasks done)`}
            className="bg-success-100 h-2 overflow-hidden rounded-full"
          >
            <div className="bg-success-600 h-full rounded-full" style={{ width: `${m.percent}%` }} />
          </div>
          {m.dueAt ? <p className="text-xs text-slate-600">Due {formatDayShort(new Date(m.dueAt), timeZone)}</p> : null}
        </li>
      ))}
    </ul>
  );
}
