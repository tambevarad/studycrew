"use client";

/**
 * SLOT COMPONENT — owned by PB-08 (notifications). The sidebar renders this.
 * PB-08 replaces the body (unread count badge, polling) but keeps the export name and no props.
 */
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell() {
  return (
    <Link href="/notifications" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Notifications">
      <Bell className="size-4" aria-hidden />
    </Link>
  );
}
