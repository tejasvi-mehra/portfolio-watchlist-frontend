import type { DiffBatchPayload, SnapshotPayload } from "./protocol";
import type { QuoteView } from "./watchlistStore";

export type MarketSessionState = {
  lastSeenSeq: number;
  quotes: Record<string, QuoteView>;
};

export type HistoryPoint = {
  symbol: string;
  price: number;
  timestampMs: number;
};

export function createMarketSessionState(): MarketSessionState {
  return {
    lastSeenSeq: 0,
    quotes: {},
  };
}

export function applySnapshotState(
  state: MarketSessionState,
  payload: SnapshotPayload,
  roundPrice: (price: number) => number = (value) => value,
): { state: MarketSessionState; historyPoints: HistoryPoint[] } {
  const snapshotSeq = payload.seq || 0;
  const lastSeenSeq =
    state.lastSeenSeq > 0 && snapshotSeq > 0 && snapshotSeq < state.lastSeenSeq
      ? snapshotSeq
      : Math.max(state.lastSeenSeq, snapshotSeq);
  const quotes: Record<string, QuoteView> = {};
  const historyPoints: HistoryPoint[] = [];

  for (const entry of payload.entries || []) {
    const symbol = String(entry.symbol || "").toUpperCase();
    const price = Number(entry.last_price);
    const updatedAtMs = Date.parse(entry.updated_at);
    if (!symbol || !Number.isFinite(price) || !Number.isFinite(updatedAtMs)) continue;

    quotes[symbol] = {
      symbol,
      lastPrice: price,
      updatedAtMs,
    };
    historyPoints.push({
      symbol,
      price: roundPrice(price),
      timestampMs: updatedAtMs,
    });
  }

  return {
    state: {
      lastSeenSeq,
      quotes,
    },
    historyPoints,
  };
}

export function applyDiffBatchState(
  state: MarketSessionState,
  payload: DiffBatchPayload,
  roundPrice: (price: number) => number = (value) => value,
): { state: MarketSessionState; applied: boolean; historyPoints: HistoryPoint[] } {
  if (!payload || !Number.isFinite(payload.seq) || payload.seq <= state.lastSeenSeq) {
    return { state, applied: false, historyPoints: [] };
  }

  const quotes = { ...state.quotes };
  const historyPoints: HistoryPoint[] = [];

  for (const diff of payload.diffs || []) {
    if (diff.last_price === undefined) continue;
    const symbol = String(diff.symbol || "").toUpperCase();
    const price = Number(diff.last_price);
    if (!symbol || !Number.isFinite(price)) continue;

    const updatedAtMs = diff.updated_at ? Date.parse(diff.updated_at) : Date.now();

    quotes[symbol] = {
      symbol,
      lastPrice: price,
      updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now(),
    };
    historyPoints.push({
      symbol,
      price: roundPrice(price),
      timestampMs: Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now(),
    });
  }

  return {
    state: {
      lastSeenSeq: payload.seq,
      quotes,
    },
    applied: true,
    historyPoints,
  };
}

export function prunePriceHistory<T extends { price: number; timestampMs: number }>(
  history: Record<string, T[]>,
  allowedSymbols: Iterable<string>,
): Record<string, T[]> {
  const allowed = new Set(Array.from(allowedSymbols, (symbol) => symbol.toUpperCase()));
  const next: Record<string, T[]> = {};
  for (const symbol of allowed) {
    if (history[symbol]) {
      next[symbol] = history[symbol];
    }
  }
  return next;
}

export function applyReplaySequence(
  state: MarketSessionState,
  batches: DiffBatchPayload[],
): MarketSessionState {
  let next = state;
  for (const batch of batches) {
    const result = applyDiffBatchState(next, batch);
    if (result.applied) {
      next = result.state;
    }
  }
  return next;
}
