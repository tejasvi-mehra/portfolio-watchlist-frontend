import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConnectionBadge } from "../components/market/ConnectionBadge";
import { WatchlistRow } from "../components/market/WatchlistRow";
import { loadPortfolioPositions, loadWatchlistSymbols, subscribeUserConfigUpdates } from "../config/userConfig";
import { computeDayChangePct } from "../domain/calculators";
import { useRealtime } from "../realtime/provider";
import { getQuoteSnapshot } from "../realtime/watchlistStore";

type SortKey = "symbol" | "lastPrice" | "openPrice" | "dayChangePct";
type SortDirection = "asc" | "desc";

const ROW_HEIGHT_PX = 41;
const VISIBLE_ROW_COUNT = 30;
const OVERSCAN_ROWS = 3;

function sortSymbols(
  symbols: string[],
  sortKey: SortKey,
  sortDirection: SortDirection,
  openPrices: Record<string, number>,
): string[] {
  const base = symbols.map((symbol) => {
    const quote = getQuoteSnapshot(symbol);
    const open = openPrices[symbol] ?? null;
    return {
      symbol,
      lastPrice: quote?.lastPrice ?? null,
      openPrice: open,
      dayChangePct: computeDayChangePct(quote?.lastPrice ?? null, open),
    };
  });

  const sign = sortDirection === "asc" ? 1 : -1;
  const sorted = [...base].sort((a, b) => {
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

  return sorted.map((row) => row.symbol);
}

function mergeSymbolOrder(previous: string[], nextSymbols: string[]): string[] {
  const nextSet = new Set(nextSymbols);
  const kept = previous.filter((symbol) => nextSet.has(symbol));
  const keptSet = new Set(kept);
  const added = nextSymbols.filter((symbol) => !keptSet.has(symbol));
  return [...kept, ...added];
}

export function WatchlistPage() {
  const { connectionState, openPrices } = useRealtime();
  const [symbols, setSymbols] = useState<string[]>(() => {
    const s = loadWatchlistSymbols();
    const p = loadPortfolioPositions().map((item) => item.symbol);
    return Array.from(new Set([...s, ...p]));
  });
  const [displayOrder, setDisplayOrder] = useState<string[]>(() => {
    const s = loadWatchlistSymbols();
    const p = loadPortfolioPositions().map((item) => item.symbol);
    return Array.from(new Set([...s, ...p]));
  });
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    return subscribeUserConfigUpdates(() => {
      const s = loadWatchlistSymbols();
      const p = loadPortfolioPositions().map((item) => item.symbol);
      const nextSymbols = Array.from(new Set([...s, ...p]));
      setSymbols(nextSymbols);
      setDisplayOrder((current) => mergeSymbolOrder(current, nextSymbols));
    });
  }, []);

  const onSort = useCallback(
    (key: SortKey) => {
      const nextDirection: SortDirection =
        sortKey === key ? (sortDirection === "asc" ? "desc" : "asc") : "asc";
      const nextKey = key;
      setSortKey(nextKey);
      setSortDirection(nextDirection);
      setDisplayOrder(sortSymbols(symbols, nextKey, nextDirection, openPrices));
    },
    [openPrices, sortDirection, sortKey, symbols],
  );

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const viewportHeightPx = VISIBLE_ROW_COUNT * ROW_HEIGHT_PX;
  const virtualWindow = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
    const endIndex = Math.min(
      displayOrder.length,
      Math.ceil((scrollTop + viewportHeightPx) / ROW_HEIGHT_PX) + OVERSCAN_ROWS,
    );
    return {
      startIndex,
      endIndex,
      visibleSymbols: displayOrder.slice(startIndex, endIndex),
      paddingTop: startIndex * ROW_HEIGHT_PX,
      paddingBottom: (displayOrder.length - endIndex) * ROW_HEIGHT_PX,
      totalHeight: displayOrder.length * ROW_HEIGHT_PX,
    };
  }, [displayOrder, scrollTop, viewportHeightPx]);

  return (
    <section>
      <h2>Watchlist</h2>
      <p className="muted">
        Connection: <ConnectionBadge state={connectionState} />
      </p>
      {symbols.length > 0 ? (
        <div
          className="table-wrap watchlist-table-wrap watchlist-virtual-scroll"
          style={{ maxHeight: viewportHeightPx }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <table className="simple-table watchlist-virtual-table">
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
            <tbody style={{ height: virtualWindow.totalHeight }}>
              {virtualWindow.paddingTop > 0 ? (
                <tr aria-hidden="true" className="watchlist-spacer-row">
                  <td colSpan={5} style={{ height: virtualWindow.paddingTop, padding: 0, border: 0 }} />
                </tr>
              ) : null}
              {virtualWindow.visibleSymbols.map((symbol) => (
                <WatchlistRow key={symbol} symbol={symbol} openPrice={openPrices[symbol] ?? null} />
              ))}
              {virtualWindow.paddingBottom > 0 ? (
                <tr aria-hidden="true" className="watchlist-spacer-row">
                  <td colSpan={5} style={{ height: virtualWindow.paddingBottom, padding: 0, border: 0 }} />
                </tr>
              ) : null}
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
