import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadPortfolioPositions, subscribeUserConfigUpdates, type UserPosition } from "../config/userConfig";
import { AnimatedNumber } from "../components/market/AnimatedNumber";
import { ConnectionBadge } from "../components/market/ConnectionBadge";
import { useRealtime } from "../realtime/provider";
import { formatUtcWithMs } from "../utils/time";

export function PortfolioPage() {
  const { connectionState, watchlist } = useRealtime();
  const [positions, setPositions] = useState<UserPosition[]>(() => loadPortfolioPositions());

  useEffect(() => {
    return subscribeUserConfigUpdates(() => {
      setPositions(loadPortfolioPositions());
    });
  }, []);

  const rows = useMemo(() => {
    return positions.map((position) => {
      const qty = Number(position.qty);
      const entryPrice = Number(position.avgCost);
      const quote = watchlist[position.symbol];
      const markPrice = quote?.lastPrice ?? null;
      const positionValue = markPrice !== null ? markPrice * qty : null;
      const costBasis = entryPrice * qty;
      const unrealizedPnl = markPrice !== null ? (markPrice - entryPrice) * qty : null;
      const roePct = unrealizedPnl !== null && costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : null;
      return {
        id: position.id,
        symbol: position.symbol,
        qty,
        entryPrice,
        markPrice,
        positionValue,
        costBasis,
        unrealizedPnl,
        roePct,
        updatedAtMs: quote?.updatedAtMs ?? null,
      };
    });
  }, [positions, watchlist]);

  const summary = useMemo(() => {
    let totalCostBasis = 0;
    let totalPositionValue = 0;
    let totalUnrealized = 0;
    for (const row of rows) {
      totalCostBasis += row.costBasis;
      if (row.positionValue !== null) totalPositionValue += row.positionValue;
      if (row.unrealizedPnl !== null) totalUnrealized += row.unrealizedPnl;
    }
    const pnlPct = totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0;
    return {
      totalCostBasis,
      totalPositionValue,
      totalUnrealized,
      totalPnlPct: pnlPct,
      tracked: rows.filter((row) => row.markPrice !== null).length,
    };
  }, [rows]);

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
        Live marks available for {summary.tracked}/{rows.length} positions.
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
              <th>ROE %</th>
                <th>Updated At (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={`/asset/${row.symbol}`}>{row.symbol}</Link>
                </td>
                <td>{row.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                <td>
                  <AnimatedNumber value={row.entryPrice} decimals={4} />
                </td>
                <td>
                  <AnimatedNumber value={row.markPrice} decimals={2} tone={row.markPrice !== null ? (row.markPrice >= row.entryPrice ? "up" : "down") : "flat"} />
                </td>
                <td>
                  <AnimatedNumber
                    value={row.positionValue}
                    decimals={2}
                    tone={row.positionValue !== null ? (row.positionValue >= row.costBasis ? "up" : "down") : "flat"}
                  />
                </td>
                <td>
                  <AnimatedNumber value={row.unrealizedPnl} decimals={2} tone={row.unrealizedPnl !== null ? (row.unrealizedPnl >= 0 ? "up" : "down") : "flat"} />
                </td>
                <td>
                  <AnimatedNumber value={row.roePct} decimals={2} tone={row.roePct !== null ? (row.roePct >= 0 ? "up" : "down") : "flat"} />
                </td>
                <td className="muted">{row.updatedAtMs ? formatUtcWithMs(row.updatedAtMs) : "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
