import { describe, expect, it } from "vitest";
import { parseServerMessage } from "./protocolGuards";

describe("protocolGuards", () => {
  it("accepts valid snapshot envelope", () => {
    const parsed = parseServerMessage({
      version: 1,
      type: "snapshot",
      payload: {
        seq: 10,
        timestamp: "2026-05-30T10:00:00.000Z",
        entries: [{ symbol: "BTC", last_price: "65000", updated_at: "2026-05-30T10:00:00.000Z", provider: "hyperliquid" }],
      },
    });
    expect(parsed?.type).toBe("snapshot");
    if (parsed?.type === "snapshot") {
      expect(parsed.payload.seq).toBe(10);
      expect(parsed.payload.entries[0]?.symbol).toBe("BTC");
    }
  });

  it("accepts valid diff_batch envelope", () => {
    const parsed = parseServerMessage({
      version: 1,
      type: "diff_batch",
      payload: {
        seq: 11,
        flushed_at: "2026-05-30T10:00:01.000Z",
        diffs: [{ symbol: "BTC", last_price: 65001, updated_at: "2026-05-30T10:00:01.000Z" }],
      },
    });
    expect(parsed?.type).toBe("diff_batch");
  });

  it("rejects malformed envelopes", () => {
    expect(parseServerMessage(null)).toBeNull();
    expect(parseServerMessage({ version: 2, type: "snapshot", payload: {} })).toBeNull();
    expect(parseServerMessage({ version: 1, type: "snapshot", payload: { seq: "bad" } })).toBeNull();
    expect(parseServerMessage({ version: 1, type: "unknown", payload: {} })).toBeNull();
  });
});
