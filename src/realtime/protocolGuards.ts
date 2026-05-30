import type {
  ConnectionState,
  ConnectionStatePayload,
  DiffBatchPayload,
  DiffEntry,
  OrderBookLevel,
  OrderBookUpdatePayload,
  SnapshotEntry,
  SnapshotPayload,
} from "./protocol";

export type ParsedServerMessage =
  | { version: 1; type: "snapshot"; payload: SnapshotPayload }
  | { version: 1; type: "diff_batch"; payload: DiffBatchPayload }
  | { version: 1; type: "connection_state"; payload: ConnectionStatePayload }
  | { version: 1; type: "orderbook_update"; payload: OrderBookUpdatePayload };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPriceValue(value: unknown): value is string | number {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && Number.isFinite(Number(value));
  return false;
}

function parseSnapshotEntry(value: unknown): SnapshotEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.symbol !== "string" || !isPriceValue(value.last_price) || typeof value.updated_at !== "string") {
    return null;
  }
  return {
    symbol: value.symbol,
    last_price: value.last_price,
    updated_at: value.updated_at,
    provider: typeof value.provider === "string" ? value.provider : "",
  };
}

function parseDiffEntry(value: unknown): DiffEntry | null {
  if (!isRecord(value) || typeof value.symbol !== "string") return null;
  if (value.last_price !== undefined && !isPriceValue(value.last_price)) return null;
  if (value.updated_at !== undefined && typeof value.updated_at !== "string") return null;
  return {
    symbol: value.symbol,
    last_price: value.last_price,
    updated_at: value.updated_at,
  };
}

function parseOrderBookLevel(value: unknown): OrderBookLevel | null {
  if (!isRecord(value)) return null;
  if (!isPriceValue(value.price) || !isPriceValue(value.size) || !isFiniteNumber(value.count)) return null;
  return {
    price: value.price as string | number,
    size: value.size as string | number,
    count: value.count,
  };
}

function parseSnapshotPayload(value: unknown): SnapshotPayload | null {
  if (!isRecord(value) || !isFiniteNumber(value.seq)) return null;
  if (!Array.isArray(value.entries)) return null;
  const entries: SnapshotEntry[] = [];
  for (const item of value.entries) {
    const parsed = parseSnapshotEntry(item);
    if (parsed) entries.push(parsed);
  }
  return {
    seq: value.seq,
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date().toISOString(),
    entries,
  };
}

function parseDiffBatchPayload(value: unknown): DiffBatchPayload | null {
  if (!isRecord(value) || !isFiniteNumber(value.seq) || typeof value.flushed_at !== "string") return null;
  if (!Array.isArray(value.diffs)) return null;
  const diffs: DiffEntry[] = [];
  for (const item of value.diffs) {
    const parsed = parseDiffEntry(item);
    if (parsed) diffs.push(parsed);
  }
  return {
    seq: value.seq,
    flushed_at: value.flushed_at,
    diffs,
  };
}

function parseConnectionStatePayload(value: unknown): ConnectionStatePayload | null {
  if (!isRecord(value) || typeof value.state !== "string") return null;
  const state = value.state as ConnectionState;
  if (state !== "connected" && state !== "reconnecting" && state !== "stale") return null;
  return {
    state,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date().toISOString(),
  };
}

function parseOrderBookPayload(value: unknown): OrderBookUpdatePayload | null {
  if (!isRecord(value) || typeof value.symbol !== "string" || typeof value.timestamp !== "string") return null;
  if (!Array.isArray(value.l2_bids) || !Array.isArray(value.l2_asks)) return null;
  const l2_bids: OrderBookLevel[] = [];
  const l2_asks: OrderBookLevel[] = [];
  for (const item of value.l2_bids) {
    const parsed = parseOrderBookLevel(item);
    if (parsed) l2_bids.push(parsed);
  }
  for (const item of value.l2_asks) {
    const parsed = parseOrderBookLevel(item);
    if (parsed) l2_asks.push(parsed);
  }
  return {
    symbol: value.symbol,
    timestamp: value.timestamp,
    l2_bids,
    l2_asks,
    l3_supported: Boolean(value.l3_supported),
  };
}

export function parseServerMessage(raw: unknown): ParsedServerMessage | null {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.type !== "string") return null;

  switch (raw.type) {
    case "snapshot": {
      const payload = parseSnapshotPayload(raw.payload);
      return payload ? { version: 1, type: "snapshot", payload } : null;
    }
    case "diff_batch": {
      const payload = parseDiffBatchPayload(raw.payload);
      return payload ? { version: 1, type: "diff_batch", payload } : null;
    }
    case "connection_state": {
      const payload = parseConnectionStatePayload(raw.payload);
      return payload ? { version: 1, type: "connection_state", payload } : null;
    }
    case "orderbook_update": {
      const payload = parseOrderBookPayload(raw.payload);
      return payload ? { version: 1, type: "orderbook_update", payload } : null;
    }
    default:
      return null;
  }
}
