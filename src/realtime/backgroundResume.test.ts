import { describe, expect, it } from "vitest";
import { shouldMarkConnectionStale } from "./connectionHealth";
import { applyDiffBatchState, applySnapshotState, createMarketSessionState } from "./marketSession";

const STALE_AFTER_MS = 6000;
const BACKGROUND_MS = 30_000;
const ts = "2026-05-30T10:00:00.000Z";

describe("backgroundResume", () => {
  it("marks connection stale after 30s with no ticks (assignment background window)", () => {
    const lastTickAtMs = 1000;
    const returnedAt = lastTickAtMs + BACKGROUND_MS;

    expect(
      shouldMarkConnectionStale({
        now: returnedAt,
        socketOpen: true,
        socketDead: false,
        lastTickAtMs,
        disconnectedAtMs: 0,
        socketOpenedAtMs: lastTickAtMs,
        serverHealthyAtMs: 0,
        staleAfterMs: STALE_AFTER_MS,
      }),
    ).toBe(true);
  });

  it("reconciles after resume replay without accepting stale diffs", () => {
    let state = createMarketSessionState();
    ({ state } = applySnapshotState(state, {
      seq: 10,
      timestamp: ts,
      entries: [{ symbol: "BTC", last_price: 65000, updated_at: ts, provider: "hyperliquid" }],
    }));

    const staleWhileAway = applyDiffBatchState(state, {
      seq: 10,
      flushed_at: ts,
      diffs: [{ symbol: "BTC", last_price: 64000, updated_at: ts }],
    });
    expect(staleWhileAway.applied).toBe(false);
    expect(staleWhileAway.state.quotes.BTC?.lastPrice).toBe(65000);

    const catchUp = applyDiffBatchState(state, {
      seq: 11,
      flushed_at: ts,
      diffs: [{ symbol: "BTC", last_price: 65100, updated_at: ts }],
    });
    expect(catchUp.applied).toBe(true);
    expect(catchUp.state.lastSeenSeq).toBe(11);
    expect(catchUp.state.quotes.BTC?.lastPrice).toBe(65100);
  });

  it("accepts lower-seq snapshot after feed restart", () => {
    let state = createMarketSessionState();
    state = {
      lastSeenSeq: 500,
      quotes: {
        BTC: { symbol: "BTC", lastPrice: 1, updatedAtMs: 1 },
      },
    };

    const restarted = applySnapshotState(state, {
      seq: 8,
      timestamp: ts,
      entries: [{ symbol: "BTC", last_price: 67000, updated_at: ts, provider: "hyperliquid" }],
    });

    expect(restarted.state.lastSeenSeq).toBe(8);
    expect(restarted.state.quotes.BTC?.lastPrice).toBe(67000);
  });
});
