"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { UserSummaryDTO } from "@/contracts/common";
import { ENTITY_LABELS } from "./format";

/** Member + category filters, kept in the URL (?actor=&entity=) so they survive reload and can be shared. */
export function ActivityFilters({ members }: { members: UserSummaryDTO[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actor = params.get("actor") ?? "";
  const entity = params.get("entity") ?? "";

  function update(key: "actor" | "entity", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filter activity">
      <div className="flex flex-col gap-1">
        <Label htmlFor="activity-actor">Member</Label>
        <Select id="activity-actor" value={actor} onChange={(e) => update("actor", e.target.value)} className="w-48">
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="activity-entity">Category</Label>
        <Select id="activity-entity" value={entity} onChange={(e) => update("entity", e.target.value)} className="w-48">
          <option value="">All activity</option>
          {Object.entries(ENTITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {actor || entity ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname, { scroll: false })}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
