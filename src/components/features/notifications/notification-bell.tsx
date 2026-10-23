"use client";

/**
 * SLOT COMPONENT — owned by PB-08 (notifications). The sidebar renders this; keep the export name and no props.
 * Shows the unread count and refreshes on mount, every 60 s, when the window regains focus, and when the
 * notifications page marks items read.
 */
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { UnreadCountDTO } from "@/contracts/notifications";
import { apiFetch } from "@/lib/api-client";
import { badgeText, bellLabel, NOTIFICATIONS_CHANGED } from "./notification-utils";

const POLL_MS = 60_000;

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      apiFetch<UnreadCountDTO>("/api/v1/me/notifications/unread-count")
        .then((r) => alive && setCount(r.count))
        .catch(() => {}); // keep the last count; the next poll retries
    };
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, []);

  const badge = badgeText(count ?? 0);
  return (
    <Link
      href="/notifications"
      aria-label={bellLabel(count)}
      className="relative rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      <Bell className="size-4" aria-hidden />
      {badge ? (
        <span
          aria-hidden
          data-testid="notification-badge"
          className="bg-danger-600 absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
