import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatedNumber } from "../components/market/AnimatedNumber";
import { ConnectionBadge } from "../components/market/ConnectionBadge";
import { Sparkline } from "../components/market/Sparkline";
import { useRealtime } from "../realtime/provider";
import { formatUtcWithMs } from "../utils/time";

export function AssetDetailPage() {
  const { symbol = "" } = useParams();
  const { subscribeAsset, unsubscribeAsset, connectionState, orderBooks, priceHistory, watchlist, openPrices } =
    useRealtime();
  const normalized = symbol.toUpperCase();
  const orderBook = orderBooks[normalized];
  const quote = watchlist[normalized];
  const history = priceHistory[normalized] || [];
  const sod = openPrices[normalized] ?? null;
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!normalized) return;
    subscribeAsset(normalized);
    return () => unsubscribeAsset(normalized);
  }, [normalized, subscribeAsset, unsubscribeAsset]);

  const markTone = useMemo(() => {
    if (quote?.lastPrice === undefined || quote?.lastPrice === null || sod === null) return "flat" as const;
    return quote.lastPrice >= sod ? ("up" as const) : ("down" as const);
  }, [quote?.lastPrice, sod]);

  const sodDayChangePct = useMemo(() => {
    if (quote?.lastPrice === undefined || quote?.lastPrice === null || sod === null || sod <= 0) return null;
    return ((quote.lastPrice - sod) / sod) * 100;
  }, [quote?.lastPrice, sod]);

  const l2StreamingHealthy =
    Boolean(orderBook) && orderBook.timestampMs > 0 && nowMs - orderBook.timestampMs <= 3000;
  const detailConnectionState =
    connectionState === "connected" && l2StreamingHealthy
      ? ("connected" as const)
      : connectionState === "reconnecting"
        ? ("reconnecting" as const)
        : ("stale" as const);

  return (
    <section>
      <h2>Asset Detail: {normalized || "Unknown"}</h2>
      <p className="muted">
        Connection: <ConnectionBadge state={detailConnectionState} />
      </p>

      <div className="summary-grid">
        <article className="card">
          <h3>Mark Price</h3>
          <AnimatedNumber value={quote?.lastPrice ?? null} decimals={2} tone={markTone} />
        </article>
        <article className="card">
          <h3>Start of Day Price</h3>
          <AnimatedNumber value={sod} decimals={2} />
        </article>
        <article className="card">
          <h3>Day Change %</h3>
          <AnimatedNumber value={sodDayChangePct} decimals={2} tone={markTone} />
        </article>
        <article className="card">
          <h3>Book Type</h3>
          <p className="muted">{orderBook?.l3Supported ? "L3" : "L2 (aggregated)"}</p>
        </article>
        <article className="card">
          <h3>Updated At (UTC)</h3>
          <p className="muted">{orderBook ? formatUtcWithMs(orderBook.timestampMs) : "--"}</p>
        </article>
      </div>

      <article className="card">
        <h3>Price Trend</h3>
        <Sparkline points={history} height={320} />
      </article>

      <div className="config-grid" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h3>Bids</h3>
          <DepthTable
            side="bid"
            rows={orderBook?.bids || []}
            maxSize={Math.max(...(orderBook?.bids || []).map((x) => x.size), 0)}
          />
        </article>
        <article className="card">
          <h3>Asks</h3>
          <DepthTable
            side="ask"
            rows={orderBook?.asks || []}
            maxSize={Math.max(...(orderBook?.asks || []).map((x) => x.size), 0)}
          />
        </article>
      </div>
    </section>
  );
}

type DepthRow = {
  price: number;
  size: number;
  count: number;
};

function DepthTable({
  side,
  rows,
  maxSize,
}: {
  side: "bid" | "ask";
  rows: DepthRow[];
  maxSize: number;
}) {
  if (!rows.length) {
    return <p className="muted">Waiting for orderbook updates...</p>;
  }
  return (
    <div className="table-wrap">
      <table className="simple-table">
        <thead>
          <tr>
            <th>Price</th>
            <th>Size</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 15).map((row, idx) => {
            const ratio = maxSize > 0 ? Math.max(0.06, row.size / maxSize) : 0.06;
            return (
              <tr key={`${side}-${idx}`}>
                <td className={side === "bid" ? "depth-bid" : "depth-ask"}>
                  {row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>
                  <div className="depth-size-cell">
                    <span>{row.size.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                    <span
                      className={`depth-bar ${side === "bid" ? "depth-bar-bid" : "depth-bar-ask"}`}
                      style={{ transform: `scaleX(${ratio})` }}
                    />
                  </div>
                </td>
                <td className="muted">{row.count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
