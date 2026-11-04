"use client";

import { Check, Trophy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { PollDTO } from "@/contracts/polls";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";
import { closesInLabel, percent } from "./poll-utils";

/**
 * One poll. Open: a radio group (changing the choice changes the vote) and results once you've voted. Closed: the
 * winner highlighted and every option's count as text. `closesLabel` is formatted on the server (no Intl here).
 */
export function PollCard({
  teamId,
  poll,
  canClose,
  closesLabel,
  now,
}: {
  teamId: string;
  poll: PollDTO;
  canClose: boolean;
  closesLabel: string;
  now: Date;
}) {
  const { run, pending } = useApiAction();
  const [choice, setChoice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const selected = choice ?? poll.myVoteOptionId;
  const showResults = poll.isClosed || poll.myVoteOptionId !== null;
  const legendId = `poll-${poll.id}-q`;

  async function castVote(optionId: string) {
    if (pending || optionId === selected) return;
    setChoice(optionId);
    const saved = await run(
      () => apiFetch<PollDTO>(`/api/v1/teams/${teamId}/polls/${poll.id}/vote`, { method: "PUT", body: { optionId } }),
      { success: poll.myVoteOptionId ? "Vote changed" : "Vote saved" },
    );
    if (!saved) setChoice(null); // show the stored vote again
  }

  async function closeNow() {
    const closed = await run(() => apiFetch<PollDTO>(`/api/v1/teams/${teamId}/polls/${poll.id}/close`, { method: "POST" }), {
      success: "Poll closed",
    });
    if (closed) setConfirming(false);
  }

  return (
    <Card className={cn("flex flex-col gap-4 p-5", poll.isClosed && "bg-slate-50")} aria-labelledby={legendId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={legendId} className="text-base font-semibold text-slate-900">
            {poll.question}
          </h3>
          <p className="text-sm text-slate-600">
            Started by {poll.createdBy.name} ·{" "}
            {poll.isClosed ? "Closed" : `${closesInLabel(poll.closesAt, now)} (${closesLabel})`}
          </p>
        </div>
        <Badge tone={poll.isClosed ? "neutral" : "brand"}>{poll.isClosed ? "Closed" : "Open"}</Badge>
      </div>

      {poll.isClosed ? (
        <ClosedResults poll={poll} />
      ) : (
        <fieldset aria-labelledby={legendId} disabled={pending} className="flex flex-col gap-2">
          {poll.options.map((o) => {
            const pct = percent(o.votes, poll.totalVotes);
            const mine = selected === o.id;
            return (
              <label
                key={o.id}
                className={cn(
                  "relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-md border px-3 py-2 text-sm",
                  mine ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:bg-slate-50",
                )}
              >
                <input
                  type="radio"
                  name={`poll-${poll.id}`}
                  value={o.id}
                  checked={mine}
                  onChange={() => castVote(o.id)}
                  className="accent-brand-600 size-4"
                />
                <span className="flex-1 font-medium text-slate-900">{o.label}</span>
                {showResults ? (
                  <span className="text-slate-700">
                    {o.votes} {o.votes === 1 ? "vote" : "votes"} ({pct}%)
                  </span>
                ) : null}
              </label>
            );
          })}
          <p className="text-xs text-slate-600">
            {showResults
              ? `${poll.totalVotes} ${poll.totalVotes === 1 ? "vote" : "votes"} so far. You can change your vote until the poll closes.`
              : `${poll.totalVotes} ${poll.totalVotes === 1 ? "vote" : "votes"} so far. Vote to see the results.`}
          </p>
        </fieldset>
      )}

      {canClose && !poll.isClosed ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={pending}>
            Close poll now
          </Button>
        </div>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          open
          title="Close this poll now?"
          description={`Voting stops and “${poll.question}” gets its final result. This can't be undone.`}
          confirmLabel="Close poll"
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={closeNow}
        />
      ) : null}
    </Card>
  );
}

function ClosedResults({ poll }: { poll: PollDTO }) {
  const winner = poll.options.find((o) => o.id === poll.winningOptionId) ?? null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
        {winner ? (
          <>
            <Trophy className="text-success-700 size-4" aria-hidden />
            Final choice: {winner.label}
          </>
        ) : (
          "No winner: nobody voted."
        )}
      </p>
      <ul className="flex flex-col gap-2" aria-label={`Results for ${poll.question}`}>
        {poll.options.map((o) => {
          const pct = percent(o.votes, poll.totalVotes);
          const won = o.id === poll.winningOptionId;
          return (
            <li key={o.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn("flex items-center gap-1.5", won ? "text-success-700 font-semibold" : "text-slate-800")}>
                  {won ? <Check className="size-4" aria-hidden /> : null}
                  {o.label}
                  {won ? <span className="sr-only">(winner)</span> : null}
                  {poll.myVoteOptionId === o.id ? <span className="text-xs font-normal text-slate-600">· your vote</span> : null}
                </span>
                <span className="text-slate-700">
                  {o.votes} {o.votes === 1 ? "vote" : "votes"} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200" aria-hidden>
                <div className={cn("h-2 rounded-full", won ? "bg-success-600" : "bg-slate-400")} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
