"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActivityDTO } from "@/contracts/activity";
import type { Page } from "@/contracts/common";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { ActivityItem } from "./activity-item";
import { groupByDay } from "./format";

/**
 * Day-grouped history with cursor pagination. The first page is rendered on the server;
 * "Load more" fetches the next page from GET /api/v1/teams/:teamId/activity with the same filters.
 * The page renders this with a `key` per filter combination, so changing filters starts fresh.
 */
export function ActivityTimeline({
  teamId,
  initial,
  timeZone,
  filters,
  nowIso,
}: {
  teamId: string;
  initial: Page<ActivityDTO>;
  timeZone: string;
  filters: { actorId?: string; entityType?: string };
  /** Server render time, so "Today"/"Yesterday" headings are identical on server and client. */
  nowIso: string;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    const qs = new URLSearchParams({ cursor });
    if (filters.actorId) qs.set("actorId", filters.actorId);
    if (filters.entityType) qs.set("entityType", filters.entityType);
    try {
      const page = await apiFetch<Page<ActivityDTO>>(`/api/v1/teams/${teamId}/activity?${qs}`);
      setItems((prev) => [...prev, ...page.items.filter((i) => !prev.some((p) => p.id === i.id))]);
      setCursor(page.nextCursor);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't load more activity. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const groups = groupByDay(items, timeZone, new Date(nowIso));

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`day-${g.key}`}>
          <h3 id={`day-${g.key}`} className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {g.label}
          </h3>
          <ul className="divide-y divide-slate-100">
            {g.items.map((item) => (
              <ActivityItem key={item.id} item={item} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      ))}
      {cursor ? (
        <div>
          <Button variant="outline" onClick={loadMore} loading={loading}>
            Load more
          </Button>
        </div>
      ) : items.length > 0 ? (
        <p className="text-sm text-slate-500">
          That&apos;s everything — you&apos;ve reached the start of this team&apos;s history.
        </p>
      ) : null}
    </div>
  );
}
