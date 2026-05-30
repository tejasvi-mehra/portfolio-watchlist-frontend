import { describe, expect, it } from "vitest";
import { computeDayChangePct, computePortfolioRow, computePortfolioSummary } from "./calculators";

describe("domain calculators", () => {
  it("computes day change percent", () => {
    expect(computeDayChangePct(110, 100)).toBe(10);
    expect(computeDayChangePct(null, 100)).toBeNull();
    expect(computeDayChangePct(110, 0)).toBeNull();
  });

  it("computes portfolio row metrics", () => {
    const row = computePortfolioRow(2, 100, 120);
    expect(row.costBasis).toBe(200);
    expect(row.positionValue).toBe(240);
    expect(row.unrealizedPnl).toBe(40);
    expect(row.roePct).toBe(20);
  });

  it("handles missing mark price in portfolio row", () => {
    const row = computePortfolioRow(2, 100, null);
    expect(row.costBasis).toBe(200);
    expect(row.positionValue).toBeNull();
    expect(row.unrealizedPnl).toBeNull();
    expect(row.roePct).toBeNull();
  });

  it("aggregates portfolio summary", () => {
    const summary = computePortfolioSummary([
      computePortfolioRow(1, 100, 110),
      computePortfolioRow(2, 50, 40),
      computePortfolioRow(1, 80, null),
    ]);
    expect(summary.totalCostBasis).toBe(280);
    expect(summary.totalPositionValue).toBe(190);
    expect(summary.totalUnrealized).toBe(-10);
    expect(summary.tracked).toBe(2);
    expect(summary.totalPnlPct).toBeCloseTo(-3.5714, 3);
  });
});
