"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { MyTeamDTO } from "@/server/shared/teams";
import { MAIN_NAV } from "./nav-config";

export function Sidebar({ user, teams }: { user: { name: string; email: string }; teams: MyTeamDTO[] }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="flex items-center justify-between px-2">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-brand-700">
          StudyCrew
        </Link>
        <NotificationBell />
      </div>

      <ul className="flex flex-col gap-0.5">
        {MAIN_NAV.map((item) => {
          const active = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium",
                  active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">My teams</h2>
          <Link href="/teams/new" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Create a team">
            <Plus className="size-4" aria-hidden />
          </Link>
        </div>
        {teams.length === 0 ? (
          <p className="px-2 text-sm text-slate-500">No teams yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {teams.map((t) => {
              const href = `/teams/${t.id}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={t.id}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm",
                      active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Users className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{t.name}</span>
                    <span className={cn("ml-auto text-xs", active ? "text-brand-800" : "text-slate-600")}>{t.courseCode}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-slate-200 px-2 pt-4">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/sign-in");
            router.refresh();
          }}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
