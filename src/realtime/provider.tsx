import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { env } from "../config/env";
import { CHART_MAX_POINTS } from "../config/chart";
import { loadPortfolioPositions, loadWatchlistSymbols, subscribeUserConfigUpdates } from "../config/userConfig";
import type {
  ConnectionState,
  ConnectionStatePayload,
  DiffBatchPayload,
  OrderBookUpdatePayload,
  SnapshotPayload,
} from "./protocol";
import { RealtimeWSClient } from "./wsClient";

type QuoteView = {
  symbol: string;
  lastPrice: number;
  updatedAtMs: number;
  dayChangePct: number;
};

type PricePoint = {
  price: number;
  timestampMs: number;
};

type DepthLevel = {
  price: number;
  size: number;
  count: number;
};

type OrderBookView = {
  symbol: string;
  timestampMs: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
  l3Supported: boolean;
};

type RealtimeContextValue = {
  connectionState: ConnectionState;
  watchlist: Record<string, QuoteView>;
  orderBooks: Record<string, OrderBookView>;
  priceHistory: Record<string, PricePoint[]>;
  openPrices: Record<string, number>;
  subscribeAsset: (symbol: string) => void;
  unsubscribeAsset: (symbol: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const STALE_AFTER_MS = 6000;
const L2_STALE_AFTER_MS = 3000;
const RETRY_INTERVAL_MS = 2000;

export function RealtimeProvider({ children }: PropsWithChildren) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("reconnecting");
  const [watchlist, setWatchlist] = useState<Record<string, QuoteView>>({});
  const [orderBooks, setOrderBooks] = useState<Record<string, OrderBookView>>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const [openPrices, setOpenPrices] = useState<Record<string, number>>({});
  const clientRef = useRef<RealtimeWSClient | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastSeenSeqRef = useRef(0);
  const lastTickAtMsRef = useRef(0);
  const baselinePriceRef = useRef<Record<string, number>>({});
  const pendingMessagesRef = useRef<unknown[]>([]);
  const rafRef = useRef<number | null>(null);
  const watchlistRef = useRef<Record<string, QuoteView>>({});
  const orderBooksRef = useRef<Record<string, OrderBookView>>({});
  const forcedSymbolsRef = useRef<Set<string>>(new Set());
  const lastRetryAtMsRef = useRef<number>(0);

  const getConfiguredSymbols = useCallback(() => {
    const fromWatchlist = loadWatchlistSymbols();
    const fromPortfolio = loadPortfolioPositions().map((item) => item.symbol);
    return Array.from(new Set([...fromWatchlist, ...fromPortfolio].map((item) => item.trim().toUpperCase())));
  }, []);

  const getDesiredSymbols = useCallback(() => {
    const configured = getConfiguredSymbols();
    const forced = Array.from(forcedSymbolsRef.current.values());
    return Array.from(new Set([...configured, ...forced]));
  }, [getConfiguredSymbols]);

  const queueResume = useCallback(() => {
    const configured = getDesiredSymbols();
    clientRef.current?.send({
      version: 1,
      type: "resume",
      payload: { symbols: configured, last_seen_seq: lastSeenSeqRef.current },
    });
  }, [getDesiredSymbols]);

  const queueInitialSubscribe = useCallback(() => {
    const configured = getDesiredSymbols();
    clientRef.current?.send({
      version: 1,
      type: "subscribe",
      payload: { symbols: configured, last_seen_seq: lastSeenSeqRef.current },
    });
  }, [getDesiredSymbols]);

  const queueForcedAssetSubscribe = useCallback(() => {
    const symbols = Array.from(forcedSymbolsRef.current.values());
    if (symbols.length === 0) return;
    clientRef.current?.send({
      version: 1,
      type: "subscribe_asset",
      payload: { symbols },
    });
  }, []);

  const retryActiveSubscriptions = useCallback(() => {
    const now = Date.now();
    if (now - lastRetryAtMsRef.current < RETRY_INTERVAL_MS) return;
    lastRetryAtMsRef.current = now;
    // Retry both base stream and detail stream per symbol.
    queueResume();
    queueForcedAssetSubscribe();
  }, [queueForcedAssetSubscribe, queueResume]);

  const applySnapshot = useCallback((payload: SnapshotPayload) => {
    lastSeenSeqRef.current = Math.max(lastSeenSeqRef.current, payload.seq || 0);
    const next: Record<string, QuoteView> = {};
    baselinePriceRef.current = {};
    for (const entry of payload.entries || []) {
      const price = Number(entry.last_price);
      const updatedAtMs = Date.parse(entry.updated_at);
      if (!Number.isFinite(price) || !Number.isFinite(updatedAtMs)) continue;
      next[entry.symbol] = {
        symbol: entry.symbol,
        lastPrice: price,
        updatedAtMs,
        dayChangePct: 0,
      };
      baselinePriceRef.current[entry.symbol] = price;
      lastTickAtMsRef.current = Math.max(lastTickAtMsRef.current, Date.now());
    }
    setPriceHistory((prev) => {
      const next = { ...prev };
      for (const entry of payload.entries || []) {
        const symbol = String(entry.symbol || "").toUpperCase();
        const price = Number(entry.last_price);
        const tickAtMs = entry.updated_at ? Date.parse(entry.updated_at) : Date.now();
        if (!symbol || !Number.isFinite(price)) continue;
        const series = next[symbol] ? [...next[symbol]] : [];
        series.push({ price, timestampMs: Number.isFinite(tickAtMs) ? tickAtMs : Date.now() });
        next[symbol] = series.slice(-CHART_MAX_POINTS);
      }
      return next;
    });
    if (Object.keys(next).length > 0) {
      setConnectionState("connected");
    }
    setWatchlist(next);
  }, []);

  const applyDiffBatch = useCallback((payload: DiffBatchPayload) => {
    if (!payload || !Number.isFinite(payload.seq) || payload.seq <= lastSeenSeqRef.current) {
      return;
    }
    lastSeenSeqRef.current = payload.seq;
    const changed: Array<{ symbol: string; price: number; timestampMs: number }> = [];
    setWatchlist((prev) => {
      const next = { ...prev };
      let applied = 0;
      for (const diff of payload.diffs || []) {
        if (diff.last_price === undefined) continue;
        const symbol = String(diff.symbol || "").toUpperCase();
        const price = Number(diff.last_price);
        if (!symbol || !Number.isFinite(price)) continue;
        const updatedAtMs = diff.updated_at ? Date.parse(diff.updated_at) : Date.now();
        if (!baselinePriceRef.current[symbol]) {
          baselinePriceRef.current[symbol] = price;
        }
        const baselinePrice = baselinePriceRef.current[symbol];
        const dayChangePct = baselinePrice > 0 ? ((price - baselinePrice) / baselinePrice) * 100 : 0;
        next[symbol] = {
          symbol,
          lastPrice: price,
          updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now(),
          dayChangePct,
        };
        lastTickAtMsRef.current = Date.now();
        applied += 1;
        changed.push({
          symbol,
          price,
          timestampMs: Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now(),
        });
      }
      if (applied > 0) {
        setConnectionState("connected");
      }
      return next;
    });
    if (changed.length > 0) {
      setPriceHistory((prev) => {
        const next = { ...prev };
        for (const item of changed) {
          const series = next[item.symbol] ? [...next[item.symbol]] : [];
          series.push({ price: item.price, timestampMs: item.timestampMs });
          next[item.symbol] = series.slice(-CHART_MAX_POINTS);
        }
        return next;
      });
    }
  }, []);

  const applyOrderBookUpdate = useCallback((payload: OrderBookUpdatePayload) => {
    const symbol = String(payload.symbol || "").toUpperCase();
    if (!symbol) return;
    const timestampMs = payload.timestamp ? Date.parse(payload.timestamp) : Date.now();
    const toLevel = (item: { price: string | number; size: string | number; count: number }): DepthLevel | null => {
      const price = Number(item.price);
      const size = Number(item.size);
      if (!Number.isFinite(price) || !Number.isFinite(size)) return null;
      return {
        price,
        size,
        count: Number.isFinite(item.count) ? item.count : 0,
      };
    };
    const bids = (payload.l2_bids || []).map(toLevel).filter((x): x is DepthLevel => x !== null);
    const asks = (payload.l2_asks || []).map(toLevel).filter((x): x is DepthLevel => x !== null);
    setOrderBooks((prev) => ({
      ...prev,
      [symbol]: {
        symbol,
        timestampMs: Number.isFinite(timestampMs) ? timestampMs : Date.now(),
        bids,
        asks,
        l3Supported: Boolean(payload.l3_supported),
      },
    }));
  }, []);

  const handleServerMessage = useCallback(
    (raw: unknown) => {
      pendingMessagesRef.current.push(raw);
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const queue = pendingMessagesRef.current.splice(0, pendingMessagesRef.current.length);
        for (const item of queue) {
          const env = (item as { type?: string; payload?: unknown }) || {};
          if (env.type === "snapshot") {
            applySnapshot((env.payload || { entries: [], seq: 0 }) as SnapshotPayload);
            continue;
          }
          if (env.type === "diff_batch") {
            applyDiffBatch((env.payload || { diffs: [], seq: 0 }) as DiffBatchPayload);
            continue;
          }
          if (env.type === "connection_state") {
            const payload = (env.payload || {}) as ConnectionStatePayload;
            if (payload.state === "connected" || payload.state === "reconnecting" || payload.state === "stale") {
              setConnectionState(payload.state);
            }
            continue;
          }
          if (env.type === "orderbook_update") {
            applyOrderBookUpdate((env.payload || {}) as OrderBookUpdatePayload);
          }
        }
      });
    },
    [applyDiffBatch, applySnapshot, applyOrderBookUpdate],
  );

  const startClient = useCallback(() => {
    const client = new RealtimeWSClient(env.wsUrl, handleServerMessage, {
      onOpen: () => {
        reconnectAttemptRef.current = 0;
        queueInitialSubscribe();
        queueForcedAssetSubscribe();
      },
      onClose: () => {
        setConnectionState("reconnecting");
        reconnectAttemptRef.current += 1;
        const delay = Math.min(1000 * reconnectAttemptRef.current, 5000);
        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          startClient();
        }, delay);
      },
      onError: () => {
        setConnectionState("reconnecting");
      },
    });
    clientRef.current = client;
    client.connect();
  }, [handleServerMessage, queueForcedAssetSubscribe, queueInitialSubscribe]);

  useEffect(() => {
    watchlistRef.current = watchlist;
  }, [watchlist]);

  useEffect(() => {
    orderBooksRef.current = orderBooks;
  }, [orderBooks]);

  useEffect(() => {
    // Keep chart time moving every second even when upstream sends no price-change diff.
    // We append the latest displayed price (same value shown as "Mark Price" in UI).
    const timer = window.setInterval(() => {
      const latestWatchlist = watchlistRef.current;
      const now = Date.now();
      setPriceHistory((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [symbol, quote] of Object.entries(latestWatchlist)) {
          if (!Number.isFinite(quote.lastPrice)) continue;
          const series = next[symbol] ? [...next[symbol]] : [];
          const last = series.length > 0 ? series[series.length - 1] : null;
          if (!last || now - last.timestampMs >= 1000) {
            series.push({ price: quote.lastPrice, timestampMs: now });
            next[symbol] = series.slice(-CHART_MAX_POINTS);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadOpenPrices = async () => {
      try {
        const res = await fetch(`${env.apiBaseUrl}/api/symbols`);
        if (!res.ok) return;
        const json = (await res.json()) as { symbols?: Array<{ symbol: string; open_price?: string | number }> };
        const next: Record<string, number> = {};
        for (const item of json.symbols || []) {
          const symbol = String(item.symbol || "").toUpperCase();
          const open = Number(item.open_price);
          if (!symbol || !Number.isFinite(open)) continue;
          next[symbol] = open;
        }
        if (!cancelled) setOpenPrices(next);
      } catch {
        // Non-fatal for realtime rendering.
      }
    };
    void loadOpenPrices();

    startClient();

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        queueResume();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const staleTimer = window.setInterval(() => {
      if (lastTickAtMsRef.current === 0) return;
      if (Date.now() - lastTickAtMsRef.current > STALE_AFTER_MS) {
        setConnectionState((prev) => (prev === "reconnecting" ? prev : "stale"));
        retryActiveSubscriptions();
      }
    }, 1000);

    const detailRetryTimer = window.setInterval(() => {
      const forced = Array.from(forcedSymbolsRef.current.values());
      if (forced.length === 0) return;
      const now = Date.now();
      let l2NeedsRetry = false;
      for (const symbol of forced) {
        const book = orderBooksRef.current[symbol];
        if (!book || now - book.timestampMs > L2_STALE_AFTER_MS) {
          l2NeedsRetry = true;
          break;
        }
      }
      if (l2NeedsRetry) {
        retryActiveSubscriptions();
      }
    }, 1000);

    const unsubscribeConfig = subscribeUserConfigUpdates(() => {
      queueResume();
    });

    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.clearInterval(staleTimer);
      window.clearInterval(detailRetryTimer);
      unsubscribeConfig();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      clientRef.current?.disconnect();
      cancelled = true;
    };
  }, [queueResume, retryActiveSubscriptions, startClient]);

  const subscribeAsset = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    forcedSymbolsRef.current.add(normalized);
    // Ensure direct asset-page load can bootstrap base stream without watchlist-first dependency.
    clientRef.current?.send({
      version: 1,
      type: "subscribe",
      payload: { symbols: getDesiredSymbols(), last_seen_seq: lastSeenSeqRef.current },
    });
    queueForcedAssetSubscribe();
  }, [getDesiredSymbols]);

  const unsubscribeAsset = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    forcedSymbolsRef.current.delete(normalized);
    clientRef.current?.send({
      version: 1,
      type: "unsubscribe_asset",
      payload: { symbols: [normalized] },
    });
  }, []);

  const value = useMemo(
    () => ({
      connectionState,
      watchlist,
      orderBooks,
      priceHistory,
      openPrices,
      subscribeAsset,
      unsubscribeAsset,
    }),
    [connectionState, watchlist, orderBooks, priceHistory, openPrices, subscribeAsset, unsubscribeAsset],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }
  return context;
}
