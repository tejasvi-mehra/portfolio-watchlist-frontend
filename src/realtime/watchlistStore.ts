import { useSyncExternalStore } from "react";

export type QuoteView = {
  symbol: string;
  lastPrice: number;
  updatedAtMs: number;
};

const globalListeners = new Set<() => void>();
const symbolListeners = new Map<string, Set<() => void>>();
let quotes: Record<string, QuoteView> = {};

function notifyGlobal() {
  for (const listener of globalListeners) {
    listener();
  }
}

function notifySymbol(symbol: string) {
  const listeners = symbolListeners.get(symbol);
  if (!listeners) return;
  for (const listener of listeners) {
    listener();
  }
}

export function getWatchlistSnapshot(): Record<string, QuoteView> {
  return quotes;
}

export function getQuoteSnapshot(symbol: string): QuoteView | undefined {
  return quotes[symbol.toUpperCase()];
}

export function subscribeWatchlist(listener: () => void): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

export function subscribeQuote(symbol: string, listener: () => void): () => void {
  const key = symbol.toUpperCase();
  let listeners = symbolListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    symbolListeners.set(key, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      symbolListeners.delete(key);
    }
  };
}

export function replaceWatchlistQuotes(next: Record<string, QuoteView>): void {
  quotes = next;
  notifyGlobal();
  for (const symbol of Object.keys(next)) {
    notifySymbol(symbol);
  }
}

export function patchWatchlistQuotes(patches: Record<string, QuoteView>): void {
  if (Object.keys(patches).length === 0) return;

  let changed = false;
  const next = { ...quotes };
  for (const [symbol, quote] of Object.entries(patches)) {
    const prev = quotes[symbol];
    if (prev && prev.lastPrice === quote.lastPrice && prev.updatedAtMs === quote.updatedAtMs) {
      continue;
    }
    next[symbol] = quote;
    changed = true;
    notifySymbol(symbol);
  }

  if (!changed) return;
  quotes = next;
  notifyGlobal();
}

export function useQuote(symbol: string): QuoteView | undefined {
  const normalized = symbol.toUpperCase();
  return useSyncExternalStore(
    (onStoreChange) => subscribeQuote(normalized, onStoreChange),
    () => getQuoteSnapshot(normalized),
    () => getQuoteSnapshot(normalized),
  );
}

export function useWatchlistSnapshot(): Record<string, QuoteView> {
  return useSyncExternalStore(subscribeWatchlist, getWatchlistSnapshot, getWatchlistSnapshot);
}

type MarksSnapshot = {
  key: string;
  marks: Record<string, number | null>;
};

let marksCache: MarksSnapshot = { key: "", marks: {} };

function portfolioKey(symbols: string[]): string {
  return [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort().join(",");
}

function buildMarksSnapshot(symbols: string[]): Record<string, number | null> {
  const marks: Record<string, number | null> = {};
  for (const symbol of symbols) {
    const key = symbol.toUpperCase();
    marks[key] = getQuoteSnapshot(key)?.lastPrice ?? null;
  }
  return marks;
}

function getPortfolioMarksSnapshot(symbols: string[]): Record<string, number | null> {
  const key = portfolioKey(symbols);
  const next = buildMarksSnapshot(symbols);
  if (marksCache.key === key) {
    let same = true;
    for (const symbol of Object.keys(next)) {
      if (marksCache.marks[symbol] !== next[symbol]) {
        same = false;
        break;
      }
    }
    if (same) return marksCache.marks;
  }
  marksCache = { key, marks: next };
  return next;
}

function subscribePortfolioMarks(symbols: string[], listener: () => void): () => void {
  const normalized = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const unsubs = normalized.map((symbol) => subscribeQuote(symbol, listener));
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

export function usePortfolioMarks(symbols: string[]): Record<string, number | null> {
  return useSyncExternalStore(
    (onStoreChange) => subscribePortfolioMarks(symbols, onStoreChange),
    () => getPortfolioMarksSnapshot(symbols),
    () => getPortfolioMarksSnapshot(symbols),
  );
}

export function __resetWatchlistStoreForTests(): void {
  quotes = {};
  marksCache = { key: "", marks: {} };
  globalListeners.clear();
  symbolListeners.clear();
}
