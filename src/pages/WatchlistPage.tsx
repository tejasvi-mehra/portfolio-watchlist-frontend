import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatedNumber } from "../components/market/AnimatedNumber";
import { ConnectionBadge } from "../components/market/ConnectionBadge";
import { loadPortfolioPositions, loadWatchlistSymbols, subscribeUserConfigUpdates } from "../config/userConfig";
import { useRealtime } from "../realtime/provider";
import { formatUtcWithMs } from "../utils/time";

type SortKey = "symbol" | "lastPrice" | "openPrice" | "dayChangePct";
type SortDirection = "asc" | "desc";

export function WatchlistPage() {
  const { connectionState, watchlist, openPrices } = useRealtime();
  const [symbols, setSymbols] = useState<string[]>(() => {
    const s = loadWatchlistSymbols();
    const p = loadPortfolioPositions().map((item) => item.symbol);
    return Array.from(new Set([...s, ...p]));
  });
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    return subscribeUserConfigUpdates(() => {
      const s = loadWatchlistSymbols();
      const p = loadPortfolioPositions().map((item) => item.symbol);
      setSymbols(Array.from(new Set([...s, ...p])));
    });
  }, []);

  const rows = useMemo(() => {
    const base = symbols.map((symbol) => {
      const row = watchlist[symbol];
      const open = openPrices[symbol] ?? null;
      const dayChangePct =
        row && open && open > 0 ? ((row.lastPrice - open) / open) * 100 : null;
      return {
        symbol,
        lastPrice: row?.lastPrice ?? null,
        openPrice: open,
        updatedAtMs: row?.updatedAtMs ?? null,
        dayChangePct,
      };
    });
    const sorted = [...base].sort((a, b) => {
      const sign = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "symbol") {
        return a.symbol.localeCompare(b.symbol) * sign;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return a.symbol.localeCompare(b.symbol);
      if (av === null) return 1;
      if (bv === null) return -1;
      return ((av as number) - (bv as number)) * sign;
    });
    return sorted;
  }, [openPrices, sortDirection, sortKey, symbols, watchlist]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  return (
    <section>
      <h2>Watchlist</h2>
      <p className="muted">
        Connection: <ConnectionBadge state={connectionState} />
      </p>
      {symbols.length > 0 ? (
        <div className="table-wrap">
          <table className="simple-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => onSort("symbol")}>
                    Symbol {sortIndicator("symbol")}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => onSort("lastPrice")}>
                    Last Price {sortIndicator("lastPrice")}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => onSort("openPrice")}>
                    Open Price (SOD UTC) {sortIndicator("openPrice")}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => onSort("dayChangePct")}>
                    Day Change % {sortIndicator("dayChangePct")}
                  </button>
                </th>
                <th>Updated At (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const updated = row.updatedAtMs ? formatUtcWithMs(row.updatedAtMs) : "--";
                const tone =
                  row.lastPrice !== null && row.openPrice !== null
                    ? row.lastPrice >= row.openPrice
                      ? "up"
                      : "down"
                    : "flat";
                return (
                  <tr key={row.symbol}>
                    <td>
                      <Link to={`/asset/${row.symbol}`}>{row.symbol}</Link>
                    </td>
                    <td>
                      <AnimatedNumber value={row.lastPrice} decimals={2} tone={tone} />
                    </td>
                    <td>
                      <AnimatedNumber value={row.openPrice} decimals={2} />
                    </td>
                    <td>
                      <AnimatedNumber value={row.dayChangePct} decimals={2} tone={tone} />
                    </td>
                    <td className="muted">{updated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          No symbols configured yet. Go to <Link to="/configure">Configure</Link> first.
        </p>
      )}
    </section>
  );
}
