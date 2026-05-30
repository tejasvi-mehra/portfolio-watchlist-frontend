import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { env } from "../config/env";
import { CHART_MAX_POINTS, roundMarkPrice } from "../config/chart";
import { loadPortfolioPositions, loadWatchlistSymbols, subscribeUserConfigUpdates } from "../config/userConfig";
import { markPerf, measurePerf } from "../utils/perf";
import type {
  ConnectionState,
  DiffBatchPayload,
  OrderBookUpdatePayload,
  SnapshotPayload,
} from "./protocol";
import { parseServerMessage } from "./protocolGuards";
import {
  applyDiffBatchState,
  applySnapshotState,
  createMarketSessionState,
  prunePriceHistory,
  type HistoryPoint,
} from "./marketSession";
import { RealtimeWSClient } from "./wsClient";
import { shouldAcceptServerStale, shouldMarkConnectionStale, shouldPromoteConnectionHealthy } from "./connectionHealth";
import {
  getWatchlistSnapshot,
  patchWatchlistQuotes,
  replaceWatchlistQuotes,
  type QuoteView,
} from "./watchlistStore";

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
  const [orderBooks, setOrderBooks] = useState<Record<string, OrderBookView>>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const [openPrices, setOpenPrices] = useState<Record<string, number>>({});
  const clientRef = useRef<RealtimeWSClient | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const sessionRef = useRef(createMarketSessionState());
  const lastSeenSeqRef = useRef(0);
  const lastTickAtMsRef = useRef(0);
  const disconnectedAtMsRef = useRef(0);
  const socketOpenedAtMsRef = useRef(0);
  const serverHealthyAtMsRef = useRef(0);
  const openPricesRef = useRef<Record<string, number>>({});
  const pendingMessagesRef = useRef<unknown[]>([]);
  const rafRef = useRef<number | null>(null);
  const watchlistRef = useRef<Record<string, QuoteView>>({});
  const orderBooksRef = useRef<Record<string, OrderBookView>>({});
  const forcedSymbolsRef = useRef<Set<string>>(new Set());
  const lastRetryAtMsRef = useRef<number>(0);
  const pendingHistoryPointsRef = useRef<Array<{ symbol: string; price: number; timestampMs: number }>>([]);
  const forcedSubscribedAtRef = useRef<Record<string, number>>({});
  const lastForcedSubscribeKeyRef = useRef<string>("");
  const lastForcedSubscribeSentAtRef = useRef<number>(0);
  const staleRecoveryAttemptsRef = useRef(0);
  const handleServerMessageRef = useRef<(raw: unknown) => void>(() => undefined);

  const loadOpenPrices = useCallback(async () => {
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
      if (Object.keys(next).length > 0) {
        openPricesRef.current = next;
        setOpenPrices(next);
      }
    } catch {
      // Retry on next reconnect or periodic refresh.
    }
  }, []);

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

  const queueFreshSubscribe = useCallback(() => {
    const symbols = getDesiredSymbols();
    clientRef.current?.send({
      version: 1,
      type: "subscribe",
      payload: {
        symbols,
        last_seen_seq: lastSeenSeqRef.current,
      },
    });
  }, [getDesiredSymbols]);

  const queueStreamResync = useCallback(() => {
    const symbols = getDesiredSymbols();
    const client = clientRef.current;
    if (!client) {
      return;
    }
    if (!client.isOpen()) {
      queueFreshSubscribe();
      return;
    }
    client.sendMany([
      { version: 1, type: "unsubscribe", payload: {} },
      {
        version: 1,
        type: "subscribe",
        payload: {
          symbols,
          last_seen_seq: lastSeenSeqRef.current,
        },
      },
    ]);
  }, [getDesiredSymbols, queueFreshSubscribe]);

  const queueForcedAssetSubscribe = useCallback((force: boolean = false) => {
    const symbols = Array.from(forcedSymbolsRef.current.values()).sort();
    if (symbols.length === 0) return;
    const key = symbols.join(",");
    const now = Date.now();
    if (!force && key === lastForcedSubscribeKeyRef.current && now - lastForcedSubscribeSentAtRef.current < RETRY_INTERVAL_MS) {
      return;
    }
    clientRef.current?.send({
      version: 1,
      type: "subscribe_asset",
      payload: { symbols },
    });
    lastForcedSubscribeKeyRef.current = key;
    lastForcedSubscribeSentAtRef.current = now;
  }, []);

  const retryActiveSubscriptions = useCallback(() => {
    const now = Date.now();
    if (now - lastRetryAtMsRef.current < RETRY_INTERVAL_MS) return;
    lastRetryAtMsRef.current = now;
    staleRecoveryAttemptsRef.current += 1;
    if (staleRecoveryAttemptsRef.current >= 3) {
      lastSeenSeqRef.current = 0;
      staleRecoveryAttemptsRef.current = 0;
    }
    queueStreamResync();
    queueForcedAssetSubscribe();
  }, [queueForcedAssetSubscribe, queueStreamResync]);

  const appendHistoryPoints = useCallback((points: HistoryPoint[]) => {
    if (points.length === 0) return;
    pendingHistoryPointsRef.current.push(...points);
  }, []);

  const markStreamHealthy = useCallback(() => {
    const now = Date.now();
    serverHealthyAtMsRef.current = now;
    lastTickAtMsRef.current = now;
    staleRecoveryAttemptsRef.current = 0;
    setConnectionState("connected");
  }, []);

  const markStreamRecovered = useCallback(() => {
    markStreamHealthy();
    queueStreamResync();
  }, [markStreamHealthy, queueStreamResync]);

  const applySnapshot = useCallback((payload: SnapshotPayload) => {
    const result = applySnapshotState(sessionRef.current, payload, roundMarkPrice);
    sessionRef.current = result.state;
    lastSeenSeqRef.current = result.state.lastSeenSeq;
    markStreamHealthy();
    replaceWatchlistQuotes(result.state.quotes);
    watchlistRef.current = result.state.quotes;
    appendHistoryPoints(result.historyPoints);
    setPriceHistory((prev) => prunePriceHistory(prev, Object.keys(result.state.quotes)));
  }, [appendHistoryPoints, markStreamHealthy]);

  const applyDiffBatch = useCallback((payload: DiffBatchPayload) => {
    const result = applyDiffBatchState(sessionRef.current, payload, roundMarkPrice);
    if (!result.applied) return;

    sessionRef.current = result.state;
    lastSeenSeqRef.current = result.state.lastSeenSeq;
    markStreamHealthy();

    const patches: Record<string, QuoteView> = {};
    for (const point of result.historyPoints) {
      const quote = result.state.quotes[point.symbol];
      if (quote) patches[point.symbol] = quote;
    }
    if (Object.keys(patches).length > 0) {
      patchWatchlistQuotes(patches);
      watchlistRef.current = getWatchlistSnapshot();
    }
    appendHistoryPoints(result.historyPoints);
  }, [appendHistoryPoints, markStreamHealthy]);

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
    delete forcedSubscribedAtRef.current[symbol];
  }, []);

  const markStreamRecoveredRef = useRef(markStreamRecovered);
  markStreamRecoveredRef.current = markStreamRecovered;

  const handleServerMessage = useCallback(
    (raw: unknown) => {
      pendingMessagesRef.current.push(raw);
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        markPerf("realtime-frame-start");
        const queue = pendingMessagesRef.current.splice(0, pendingMessagesRef.current.length);
        for (const item of queue) {
          const parsed = parseServerMessage(item);
          if (!parsed) continue;
          if (parsed.type === "snapshot") {
            applySnapshot(parsed.payload);
            continue;
          }
          if (parsed.type === "diff_batch") {
            applyDiffBatch(parsed.payload);
            continue;
          }
          if (parsed.type === "connection_state") {
            if (parsed.payload.state === "connected") {
              markStreamRecoveredRef.current();
              continue;
            }
            if (parsed.payload.state === "reconnecting") {
              setConnectionState("reconnecting");
              continue;
            }
            if (
              parsed.payload.state === "stale" &&
              shouldAcceptServerStale(
                lastTickAtMsRef.current,
                Date.now(),
                STALE_AFTER_MS,
                socketOpenedAtMsRef.current,
                serverHealthyAtMsRef.current,
              )
            ) {
              setConnectionState("stale");
            }
            continue;
          }
          if (parsed.type === "orderbook_update") {
            applyOrderBookUpdate(parsed.payload);
          }
        }
        if (pendingHistoryPointsRef.current.length > 0) {
          setPriceHistory((prev) => {
            const next = { ...prev };
            for (const item of pendingHistoryPointsRef.current) {
              const series = next[item.symbol] ? [...next[item.symbol]] : [];
              series.push({ price: item.price, timestampMs: item.timestampMs });
              next[item.symbol] = series.slice(-CHART_MAX_POINTS);
            }
            return next;
          });
          pendingHistoryPointsRef.current = [];
        }
        markPerf("realtime-frame-end");
        measurePerf("realtime-frame-apply", "realtime-frame-start", "realtime-frame-end");
      });
    },
    [applyDiffBatch, applySnapshot, applyOrderBookUpdate],
  );

  handleServerMessageRef.current = handleServerMessage;

  const beginReconnect = useCallback(() => {
    disconnectedAtMsRef.current = Date.now();
    setConnectionState("reconnecting");
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    clientRef.current?.reconnect();
  }, []);

  const scheduleReconnect = useCallback(() => {
    reconnectAttemptRef.current += 1;
    const delay = Math.min(1000 * reconnectAttemptRef.current, 5000);
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      beginReconnect();
    }, delay);
  }, [beginReconnect]);

  const handleSocketOpen = useCallback(() => {
    reconnectAttemptRef.current = 0;
    disconnectedAtMsRef.current = 0;
    socketOpenedAtMsRef.current = Date.now();
    setConnectionState("reconnecting");
    void loadOpenPrices();
    queueFreshSubscribe();
    queueForcedAssetSubscribe(true);
  }, [loadOpenPrices, queueForcedAssetSubscribe, queueFreshSubscribe]);

  const handleSocketClose = useCallback(() => {
    disconnectedAtMsRef.current = Date.now();
    setConnectionState("reconnecting");
    scheduleReconnect();
  }, [scheduleReconnect]);

  const ensureClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;
    clientRef.current = new RealtimeWSClient(env.wsUrl, (raw) => handleServerMessageRef.current(raw), {
      onOpen: handleSocketOpen,
      onClose: handleSocketClose,
      onError: () => {
        setConnectionState("reconnecting");
      },
    });
    return clientRef.current;
  }, [handleSocketClose, handleSocketOpen]);

  const connectClient = useCallback(() => {
    ensureClient().connect();
  }, [ensureClient]);

  const handleForeground = useCallback(() => {
    if (document.visibilityState !== "visible") return;

    const client = clientRef.current;
    if (!client) {
      connectClient();
      return;
    }
    if (client.isDead()) {
      beginReconnect();
      return;
    }
    queueStreamResync();
  }, [beginReconnect, connectClient, queueStreamResync]);

  useEffect(() => {
    orderBooksRef.current = orderBooks;
  }, [orderBooks]);

  useEffect(() => {
    openPricesRef.current = openPrices;
  }, [openPrices]);

  useEffect(() => {
    // Keep chart time moving every second
    const timer = window.setInterval(() => {
      const latestWatchlist = watchlistRef.current;
      const now = Date.now();
      setPriceHistory((prev) => {
        let changed = false;
        const next = { ...prev };
        const candidates = new Set<string>([
          ...Object.keys(prev),
          ...Array.from(forcedSymbolsRef.current.values()),
        ]);
        for (const symbol of candidates) {
          const quote = latestWatchlist[symbol];
          if (!quote) continue;
          if (!Number.isFinite(quote.lastPrice)) continue;
          const series = next[symbol] ? [...next[symbol]] : [];
          const last = series.length > 0 ? series[series.length - 1] : null;
          if (!last || now - last.timestampMs >= 1000) {
            series.push({ price: roundMarkPrice(quote.lastPrice), timestampMs: now });
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
    void loadOpenPrices();
    connectClient();

    const visibilityHandler = () => {
      handleForeground();
    };
    const pageShowHandler = (event: PageTransitionEvent) => {
      if (event.persisted) {
        handleForeground();
      }
    };
    const pageResumeHandler = () => {
      handleForeground();
    };

    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("pageshow", pageShowHandler);
    document.addEventListener("resume", pageResumeHandler);
    if ("wasDiscarded" in document && (document as Document & { wasDiscarded?: boolean }).wasDiscarded) {
      handleForeground();
    }

    const staleTimer = window.setInterval(() => {
      const client = clientRef.current;
      const now = Date.now();
      const healthInput = {
        now,
        socketOpen: client?.isOpen() ?? false,
        socketDead: !client || client.isDead(),
        lastTickAtMs: lastTickAtMsRef.current,
        disconnectedAtMs: disconnectedAtMsRef.current,
        socketOpenedAtMs: socketOpenedAtMsRef.current,
        serverHealthyAtMs: serverHealthyAtMsRef.current,
        staleAfterMs: STALE_AFTER_MS,
      };

      if (shouldMarkConnectionStale(healthInput)) {
        setConnectionState("stale");
        if (!client || client.isDead()) {
          beginReconnect();
        } else {
          retryActiveSubscriptions();
        }
        return;
      }

      if (shouldPromoteConnectionHealthy(healthInput)) {
        setConnectionState((prev) => (prev === "stale" || prev === "reconnecting" ? "connected" : prev));
      }
    }, 1000);

    const openPriceRetryTimer = window.setInterval(() => {
      const client = clientRef.current;
      if (!client || !client.isOpen()) return;
      if (Object.keys(openPricesRef.current).length > 0) return;
      void loadOpenPrices();
    }, 5000);

    const detailRetryTimer = window.setInterval(() => {
      const forced = Array.from(forcedSymbolsRef.current.values());
      if (forced.length === 0) return;
      const now = Date.now();
      let l2NeedsRetry = false;
      for (const symbol of forced) {
        const book = orderBooksRef.current[symbol];
        const subscribedAt = forcedSubscribedAtRef.current[symbol] || 0;
        const awaitingFirstBook = !book && subscribedAt > 0 && now-subscribedAt < L2_STALE_AFTER_MS;
        if (awaitingFirstBook) {
          continue;
        }
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
      queueStreamResync();
    });

    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("pageshow", pageShowHandler);
      document.removeEventListener("resume", pageResumeHandler);
      window.clearInterval(staleTimer);
      window.clearInterval(openPriceRetryTimer);
      window.clearInterval(detailRetryTimer);
      unsubscribeConfig();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [beginReconnect, connectClient, handleForeground, loadOpenPrices, queueStreamResync, retryActiveSubscriptions]);

  const subscribeAsset = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    forcedSymbolsRef.current.add(normalized);
    forcedSubscribedAtRef.current[normalized] = Date.now();
    // Ensure direct asset-page load can bootstrap base stream without watchlist-first dependency.
    clientRef.current?.send({
      version: 1,
      type: "subscribe",
      payload: { symbols: getDesiredSymbols(), last_seen_seq: lastSeenSeqRef.current },
    });
    queueForcedAssetSubscribe(true);
  }, [getDesiredSymbols, queueForcedAssetSubscribe]);

  const unsubscribeAsset = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    forcedSymbolsRef.current.delete(normalized);
    delete forcedSubscribedAtRef.current[normalized];
    clientRef.current?.send({
      version: 1,
      type: "unsubscribe_asset",
      payload: { symbols: [normalized] },
    });
  }, []);

  const value = useMemo(
    () => ({
      connectionState,
      orderBooks,
      priceHistory,
      openPrices,
      subscribeAsset,
      unsubscribeAsset,
    }),
    [connectionState, orderBooks, priceHistory, openPrices, subscribeAsset, unsubscribeAsset],
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
