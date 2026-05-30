import { beforeEach, describe, expect, it } from "vitest";
import {
  applyDiffBatchState,
  applyReplaySequence,
  applySnapshotState,
  createMarketSessionState,
} from "./marketSession";

const ts = "2026-05-30T10:00:00.000Z";

describe("marketSession", () => {
  it("snapshot replaces state and drops symbols not in payload", () => {
    let state = createMarketSessionState();
    state = {
      lastSeenSeq: 4,
      quotes: {
        BTC: { symbol: "BTC", lastPrice: 1, updatedAtMs: 1 },
        ETH: { symbol: "ETH", lastPrice: 2, updatedAtMs: 2 },
      },
    };

    const result = applySnapshotState(state, {
      seq: 10,
      timestamp: ts,
      entries: [{ symbol: "BTC", last_price: 65000, updated_at: ts, provider: "hyperliquid" }],
    });

    expect(result.state.lastSeenSeq).toBe(10);
    expect(result.state.quotes.BTC?.lastPrice).toBe(65000);
    expect(result.state.quotes.ETH).toBeUndefined();
  });

  it("applyDiffBatch rejects seq <= lastSeen", () => {
    let state = createMarketSessionState();
    ({ state } = applySnapshotState(state, {
      seq: 10,
      timestamp: ts,
      entries: [{ symbol: "BTC", last_price: 65000, updated_at: ts, provider: "hyperliquid" }],
    }));

    const stale = applyDiffBatchState(state, {
      seq: 10,
      flushed_at: ts,
      diffs: [{ symbol: "BTC", last_price: 65100, updated_at: ts }],
    });
    expect(stale.applied).toBe(false);
    expect(stale.state.lastSeenSeq).toBe(10);
    expect(stale.state.quotes.BTC?.lastPrice).toBe(65000);

    const replay = applyDiffBatchState(state, {
      seq: 11,
      flushed_at: ts,
      diffs: [{ symbol: "BTC", last_price: 65100, updated_at: ts }],
    });
    expect(replay.applied).toBe(true);
    expect(replay.state.lastSeenSeq).toBe(11);
    expect(replay.state.quotes.BTC?.lastPrice).toBe(65100);
  });

  it("resets sequence when snapshot seq is lower after server restart", () => {
    let state = createMarketSessionState();
    state = {
      lastSeenSeq: 500,
      quotes: {},
    };

    const result = applySnapshotState(state, {
      seq: 8,
      timestamp: ts,
      entries: [{ symbol: "BTC", last_price: 65000, updated_at: ts, provider: "hyperliquid" }],
    });

    expect(result.state.lastSeenSeq).toBe(8);
  });

  it("resume path applies replay batches 11-15 after snapshot at seq 10", () => {
    let state = createMarketSessionState();
    ({ state } = applySnapshotState(state, {
      seq: 10,
      timestamp: ts,
      entries: [{ symbol: "BTC", last_price: 65000, updated_at: ts, provider: "hyperliquid" }],
    }));

    state = applyReplaySequence(state, [
      {
        seq: 11,
        flushed_at: ts,
        diffs: [{ symbol: "BTC", last_price: 65001, updated_at: ts }],
      },
      {
        seq: 12,
        flushed_at: ts,
        diffs: [{ symbol: "BTC", last_price: 65002, updated_at: ts }],
      },
      {
        seq: 13,
        flushed_at: ts,
        diffs: [{ symbol: "BTC", last_price: 65003, updated_at: ts }],
      },
      {
        seq: 14,
        flushed_at: ts,
        diffs: [{ symbol: "BTC", last_price: 65004, updated_at: ts }],
      },
      {
        seq: 15,
        flushed_at: ts,
        diffs: [{ symbol: "BTC", last_price: 65005, updated_at: ts }],
      },
    ]);

    expect(state.lastSeenSeq).toBe(15);
    expect(state.quotes.BTC?.lastPrice).toBe(65005);
  });
});
