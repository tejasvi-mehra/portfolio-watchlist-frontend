export type PortfolioRowMetrics = {
  positionValue: number | null;
  costBasis: number;
  unrealizedPnl: number | null;
  roiPct: number | null;
};

export type PortfolioSummary = {
  totalCostBasis: number;
  totalPositionValue: number;
  totalUnrealized: number;
  totalPnlPct: number;
  tracked: number;
};

export function computeDayChangePct(lastPrice: number | null, openPrice: number | null): number | null {
  if (lastPrice === null || openPrice === null || openPrice <= 0) return null;
  return ((lastPrice - openPrice) / openPrice) * 100;
}

export function computePortfolioRow(qty: number, entryPrice: number, markPrice: number | null): PortfolioRowMetrics {
  const costBasis = entryPrice * qty;
  if (markPrice === null) {
    return {
      positionValue: null,
      costBasis,
      unrealizedPnl: null,
      roiPct: null,
    };
  }
  const positionValue = markPrice * qty;
  const unrealizedPnl = (markPrice - entryPrice) * qty;
  const roiPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : null;
  return {
    positionValue,
    costBasis,
    unrealizedPnl,
    roiPct,
  };
}

export function computePortfolioSummary(rows: PortfolioRowMetrics[]): PortfolioSummary {
  let totalCostBasis = 0;
  let totalPositionValue = 0;
  let totalUnrealized = 0;
  let tracked = 0;
  for (const row of rows) {
    totalCostBasis += row.costBasis;
    if (row.positionValue !== null) {
      totalPositionValue += row.positionValue;
      tracked += 1;
    }
    if (row.unrealizedPnl !== null) totalUnrealized += row.unrealizedPnl;
  }
  return {
    totalCostBasis,
    totalPositionValue,
    totalUnrealized,
    totalPnlPct: totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0,
    tracked,
  };
}
