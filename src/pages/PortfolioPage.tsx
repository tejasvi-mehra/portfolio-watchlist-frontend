import { useEffect, useMemo, useState } from "react";
import { loadPortfolioPositions, subscribeUserConfigUpdates, type UserPosition } from "../config/userConfig";
import { AnimatedNumber } from "../components/market/AnimatedNumber";
import { ConnectionBadge } from "../components/market/ConnectionBadge";
import { PortfolioRow } from "../components/market/PortfolioRow";
import { computePortfolioRow, computePortfolioSummary } from "../domain/calculators";
import { useRealtime } from "../realtime/provider";
import { usePortfolioMarks } from "../realtime/watchlistStore";

export function PortfolioPage() {
  const { connectionState } = useRealtime();
  const [positions, setPositions] = useState<UserPosition[]>(() => loadPortfolioPositions());
  const symbols = useMemo(() => positions.map((position) => position.symbol), [positions]);
  const marks = usePortfolioMarks(symbols);

  useEffect(() => {
    return subscribeUserConfigUpdates(() => {
      setPositions(loadPortfolioPositions());
    });
  }, []);

  const summary = useMemo(() => {
    const rows = positions.map((position) => {
      const qty = Number(position.qty);
      const entryPrice = Number(position.avgCost);
      const markPrice = marks[position.symbol.toUpperCase()] ?? null;
      return computePortfolioRow(qty, entryPrice, markPrice);
    });
    return computePortfolioSummary(rows);
  }, [positions, marks]);

  return (
    <section>
      <h2>Portfolio</h2>
      <p className="muted">
        Connection: <ConnectionBadge state={connectionState} />
      </p>

      <div className="summary-grid">
        <article className="card">
          <h3>Total Position Value</h3>
          <AnimatedNumber
            value={summary.totalPositionValue}
            decimals={2}
            tone={summary.totalPositionValue >= summary.totalCostBasis ? "up" : "down"}
          />
        </article>
        <article className="card">
          <h3>Total Cost Basis</h3>
          <AnimatedNumber value={summary.totalCostBasis} decimals={2} />
        </article>
        <article className="card">
          <h3>Unrealized P&amp;L</h3>
          <AnimatedNumber
            value={summary.totalUnrealized}
            decimals={2}
            tone={summary.totalPositionValue >= summary.totalCostBasis ? "up" : "down"}
          />
        </article>
        <article className="card">
          <h3>P&amp;L %</h3>
          <AnimatedNumber
            value={summary.totalPnlPct}
            decimals={2}
            tone={summary.totalPositionValue >= summary.totalCostBasis ? "up" : "down"}
          />
        </article>
      </div>

      <p className="muted">
        Live marks available for {summary.tracked}/{positions.length} positions.
      </p>

      <div className="table-wrap">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Size</th>
              <th>Entry Price (UTC basis)</th>
              <th>Mark Price</th>
              <th>Position Value</th>
              <th>Unrealized P&amp;L</th>
              <th>ROI %</th>
              <th>Updated At (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <PortfolioRow key={position.id} position={position} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
