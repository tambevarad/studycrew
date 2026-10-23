/**
 * Card ordering inside a board column (PB-05). Positions are floats; a moved card takes the midpoint of its new
 * neighbours so only that one row changes. When neighbours get too close the column is renumbered.
 */
export const POSITION_STEP = 1000;
export const MIN_GAP = 0.001;

/**
 * Position for a card inserted at `index` among `sortedPositions` (the column without the moved card, ascending).
 * `index` is clamped to [0, length].
 */
export function positionForIndex(
  sortedPositions: readonly number[],
  index: number,
): { position: number; needsRebalance: boolean } {
  const n = sortedPositions.length;
  if (n === 0) return { position: POSITION_STEP, needsRebalance: false };
  const i = Math.max(0, Math.min(index, n));
  if (i === 0) return { position: sortedPositions[0] - POSITION_STEP, needsRebalance: false };
  if (i === n) return { position: sortedPositions[n - 1] + POSITION_STEP, needsRebalance: false };
  const before = sortedPositions[i - 1];
  const after = sortedPositions[i];
  return { position: (before + after) / 2, needsRebalance: after - before < MIN_GAP };
}

/** Evenly spaced positions (1000, 2000, …) for a renumbered column of `count` cards. */
export function rebalancedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
