"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import type { PollDTO } from "@/contracts/polls";
import { CreatePollDialog } from "./create-poll-dialog";
import { PollCard } from "./poll-card";

/**
 * PB-14 `/teams/[teamId]/polls`. Open polls first, then closed ones. All date text arrives pre-formatted from the
 * server (`closesLabels`). The countdown starts from the server's `nowIso` (so hydration matches) and then ticks each
 * minute in the browser.
 */
export function PollsView({
  teamId,
  polls,
  closableIds,
  closesLabels,
  timeZone,
  nowIso,
}: {
  teamId: string;
  polls: PollDTO[];
  /** Polls the viewer may close early (creator or leader). */
  closableIds: string[];
  closesLabels: Record<string, string>;
  timeZone: string;
  nowIso: string;
}) {
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(() => new Date(nowIso));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const open = polls.filter((p) => !p.isClosed);
  const closed = polls.filter((p) => p.isClosed);
  const newPollButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      New poll
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Polls"
        description="Decide together: meeting places, topics, who presents. The result is recorded when the poll closes."
        actions={polls.length > 0 ? newPollButton : null}
      />

      {polls.length === 0 ? (
        <EmptyState
          title="No polls yet"
          description="Ask the team a question with 2–6 options. Everyone gets one vote they can change until it closes."
          action={newPollButton}
        />
      ) : (
        <>
          <section aria-labelledby="open-polls" className="flex flex-col gap-3">
            <h3 id="open-polls" className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
              Open ({open.length})
            </h3>
            {open.length === 0 ? (
              <p className="text-sm text-slate-600">No open polls. Start one to ask the team something.</p>
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2" aria-label="Open polls">
                {open.map((p) => (
                  <li key={p.id}>
                    <PollCard
                      teamId={teamId}
                      poll={p}
                      canClose={closableIds.includes(p.id)}
                      closesLabel={closesLabels[p.id] ?? ""}
                      now={now}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {closed.length > 0 ? (
            <section aria-labelledby="closed-polls" className="flex flex-col gap-3">
              <h3 id="closed-polls" className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
                Closed ({closed.length})
              </h3>
              <ul className="grid gap-4 lg:grid-cols-2" aria-label="Closed polls">
                {closed.map((p) => (
                  <li key={p.id}>
                    <PollCard teamId={teamId} poll={p} canClose={false} closesLabel={closesLabels[p.id] ?? ""} now={now} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {creating ? <CreatePollDialog teamId={teamId} timeZone={timeZone} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
