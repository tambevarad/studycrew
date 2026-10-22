"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TEAM_TABS } from "./team-tabs";

export function TeamTabNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();
  const root = `/teams/${teamId}`;
  return (
    <nav aria-label="Team sections" className="-mb-px flex gap-1 overflow-x-auto">
      {TEAM_TABS.map((tab) => {
        const href = tab.segment ? `${root}/${tab.segment}` : root;
        const active = tab.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === root;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium",
              active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
