/**
 * Pure poll results (PB-14). No database access, so they are unit-tested directly and shared by the service.
 */

export interface TallyRow {
  optionId: string;
  label: string;
  position: number;
  votes: number;
}

/** One row per option in `position` order, with its vote count (options nobody picked get 0). */
export function tally(
  options: ReadonlyArray<{ id: string; label: string; position: number }>,
  votes: ReadonlyArray<{ optionId: string }>,
): TallyRow[] {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1);
  return [...options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ optionId: o.id, label: o.label, position: o.position, votes: counts.get(o.id) ?? 0 }));
}

/** AC4: the option with the most votes; a tie goes to the option listed first; no votes at all → null ("No winner"). */
export function pickWinner(rows: readonly TallyRow[]): TallyRow | null {
  let best: TallyRow | null = null;
  for (const row of rows) {
    if (row.votes === 0) continue;
    if (!best || row.votes > best.votes || (row.votes === best.votes && row.position < best.position)) best = row;
  }
  return best;
}

/** Activity text for a closed poll (AC3), e.g. `closed the poll “Q” — winner: “A” (3 votes)`. */
export function closedSummary(question: string, winner: TallyRow | null, automatic: boolean): string {
  const how = automatic ? " at its closing time" : "";
  const result = winner
    ? `winner: “${winner.label}” (${winner.votes} ${winner.votes === 1 ? "vote" : "votes"})`
    : "no winner (no votes)";
  return `closed the poll “${question}”${how} — ${result}`;
}

/** Percent of all votes, rounded, for bars and screen-reader text. 0 when nobody voted. */
export function percent(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100);
}
