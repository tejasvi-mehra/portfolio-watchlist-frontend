import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetWatchlistStoreForTests,
  getQuoteSnapshot,
  getWatchlistSnapshot,
  patchWatchlistQuotes,
  replaceWatchlistQuotes,
} from "./watchlistStore";

describe("watchlistStore", () => {
  beforeEach(() => {
    __resetWatchlistStoreForTests();
  });

  it("replaces full watchlist snapshot", () => {
    replaceWatchlistQuotes({
      BTC: { symbol: "BTC", lastPrice: 70000, updatedAtMs: 1 },
    });
    expect(getWatchlistSnapshot().BTC.lastPrice).toBe(70000);
  });

  it("patches only changed symbols and keeps stable references", () => {
    replaceWatchlistQuotes({
      BTC: { symbol: "BTC", lastPrice: 70000, updatedAtMs: 1 },
      ETH: { symbol: "ETH", lastPrice: 2000, updatedAtMs: 1 },
    });
    const ethBefore = getQuoteSnapshot("ETH");

    patchWatchlistQuotes({
      BTC: { symbol: "BTC", lastPrice: 71000, updatedAtMs: 2 },
      ETH: { symbol: "ETH", lastPrice: 2000, updatedAtMs: 1 },
    });

    expect(getQuoteSnapshot("BTC")?.lastPrice).toBe(71000);
    expect(getQuoteSnapshot("ETH")).toBe(ethBefore);
  });

  it("buildPortfolioMarksSnapshot reads only requested symbols", () => {
    replaceWatchlistQuotes({
      BTC: { symbol: "BTC", lastPrice: 70000, updatedAtMs: 1 },
      ETH: { symbol: "ETH", lastPrice: 2000, updatedAtMs: 1 },
    });

    patchWatchlistQuotes({
      ETH: { symbol: "ETH", lastPrice: 2100, updatedAtMs: 2 },
    });

    expect(getQuoteSnapshot("BTC")?.lastPrice).toBe(70000);
    expect(getQuoteSnapshot("ETH")?.lastPrice).toBe(2100);
  });
});
