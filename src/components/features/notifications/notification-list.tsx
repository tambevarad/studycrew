"use client";

import {
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Mail,
  UserCheck,
  UserPlus,
  Vote,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Page } from "@/contracts/common";
import type { NotificationDTO, NotificationTypeValue } from "@/contracts/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";
import { groupByAge, NOTIFICATIONS_CHANGED } from "./notification-utils";

const ICONS: Record<NotificationTypeValue, LucideIcon> = {
  TEAM_INVITE: Mail,
  JOIN_REQUEST: UserPlus,
  JOIN_DECISION: UserCheck,
  TASK_ASSIGNED: ClipboardList,
  TASK_DUE_SOON: CalendarClock,
  MEETING_SCHEDULED: CalendarDays,
  MEETING_UPDATED: CalendarDays,
  POLL_CREATED: Vote,
  POLL_CLOSED: Vote,
};

const announceChange = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export function NotificationList({
  initial,
  unreadOnly,
  teamNames,
  timeZone,
  nowIso,
}: {
  initial: Page<NotificationDTO>;
  unreadOnly: boolean;
  teamNames: Record<string, string>;
  timeZone: string;
  /** Server time, so relative times render the same on the server and in the browser. */
  nowIso: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setItems(initial.items);
    setNextCursor(initial.nextCursor);
  }
  const [loadingMore, setLoadingMore] = useState(false);
  const markAll = useApiAction();
  const now = new Date(nowIso);
  const hasUnread = items.some((n) => !n.readAt);

  async function open(n: NotificationDTO) {
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      // Mark read before navigating; if it fails the notification simply stays unread.
      await apiFetch("/api/v1/me/notifications/read", { method: "POST", body: { ids: [n.id] } }).catch(() => {});
      announceChange();
    }
    if (n.link) router.push(n.link);
  }

  async function onMarkAll() {
    const res = await markAll.run(
      () => apiFetch<{ updated: number }>("/api/v1/me/notifications/read", { method: "POST", body: { all: true } }),
      { success: "All notifications marked as read" },
    );
    if (res) announceChange();
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ cursor: nextCursor, unreadOnly: String(unreadOnly) });
      const page = await apiFetch<Page<NotificationDTO>>(`/api/v1/me/notifications?${qs}`);
      setItems((list) => [...list, ...page.items.filter((n) => !list.some((x) => x.id === n.id))]);
      setNextCursor(page.nextCursor);
    } catch {
      // Leave the button so the user can try again; the list stays as it is.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Invites, join requests, assignments, due-soon reminders, meetings, and polls."
        actions={
          <Button onClick={onMarkAll} loading={markAll.pending} disabled={!hasUnread}>
            <CheckCheck aria-hidden />
            Mark all as read
          </Button>
        }
      />
      <nav aria-label="Filter notifications" className="mb-6 flex gap-1 border-b border-slate-200">
        {[
          { label: "All", href: "/notifications", active: !unreadOnly },
          { label: "Unread", href: "/notifications?filter=unread", active: unreadOnly },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab.active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          title="You're all caught up."
          description={
            unreadOnly
              ? "No unread notifications. New invites, assignments, and reminders will show up here."
              : "Nothing here yet. Invites, task assignments, due-soon reminders, meetings, and polls will show up here."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groupByAge(items, now, timeZone).map((group) => (
            <section key={group.label} aria-labelledby={`group-${group.label}`}>
              <h2 id={`group-${group.label}`} className="mb-2 text-sm font-semibold text-slate-700">
                {group.label}
              </h2>
              <ul className="bg-surface divide-y divide-slate-100 rounded-lg border border-slate-200">
                {group.items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  const team = n.teamId ? teamNames[n.teamId] : null;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n)}
                        className={cn(
                          "flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left hover:bg-slate-50",
                          n.readAt ? "border-transparent" : "border-brand-600 bg-brand-50/40",
                        )}
                      >
                        <Icon className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={cn("text-sm text-slate-900", !n.readAt && "font-semibold")}>
                            {!n.readAt ? <span className="sr-only">Unread: </span> : null}
                            {n.title}
                          </span>
                          {n.body ? <span className="text-sm text-slate-600">{n.body}</span> : null}
                          <span className="text-xs text-slate-600">
                            {team ? `${team} · ` : null}
                            <time dateTime={n.createdAt} title={formatDateTime(n.createdAt, timeZone)}>
                              {relativeTime(n.createdAt, now, timeZone)}
                            </time>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
