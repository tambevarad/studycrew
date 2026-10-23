import { describe, expect, it } from "vitest";
import { positionForIndex, rebalancedPositions } from "@/server/services/tasks/positions";

describe("PB-05 positionForIndex", () => {
  it("empty column → 1000", () => {
    expect(positionForIndex([], 0)).toEqual({ position: 1000, needsRebalance: false });
    expect(positionForIndex([], 5)).toEqual({ position: 1000, needsRebalance: false });
  });

  it("AC4: start, middle, and end give strictly increasing positions", () => {
    const col = [1000, 2000, 3000];
    const start = positionForIndex(col, 0).position;
    const middle = positionForIndex(col, 1).position;
    const end = positionForIndex(col, 3).position;
    expect(start).toBe(0);
    expect(middle).toBe(1500);
    expect(end).toBe(4000);
    expect(start < col[0] && col[0] < middle && middle < col[1] && col[2] < end).toBe(true);
  });

  it("clamps indexes past the end and below zero", () => {
    expect(positionForIndex([1000], 99).position).toBe(2000);
    expect(positionForIndex([1000], -3).position).toBe(0);
  });

  it("AC4: a tiny gap asks for a rebalance", () => {
    expect(positionForIndex([1000, 1000.0005], 1)).toEqual({ position: 1000.00025, needsRebalance: true });
    expect(positionForIndex([1000, 1001], 1).needsRebalance).toBe(false);
  });

  it("rebalanced positions are evenly spaced", () => {
    expect(rebalancedPositions(3)).toEqual([1000, 2000, 3000]);
    expect(rebalancedPositions(0)).toEqual([]);
  });
});
