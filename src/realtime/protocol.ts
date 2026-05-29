export type ConnectionState = "connected" | "reconnecting" | "stale";

export type ClientEnvelope<TPayload> = {
  version: 1;
  type:
    | "subscribe"
    | "resume"
    | "unsubscribe"
    | "subscribe_asset"
    | "unsubscribe_asset";
  payload: TPayload;
};

export type ServerEnvelope<TPayload> = {
  version: 1;
  type: "snapshot" | "diff_batch" | "connection_state" | "orderbook_update";
  payload: TPayload;
};

export type SnapshotEntry = {
  symbol: string;
  last_price: string | number;
  updated_at: string;
  provider: string;
};

export type SnapshotPayload = {
  seq: number;
  timestamp: string;
  entries: SnapshotEntry[];
};

export type DiffEntry = {
  symbol: string;
  last_price?: string | number;
  updated_at?: string;
};

export type DiffBatchPayload = {
  seq: number;
  flushed_at: string;
  diffs: DiffEntry[];
};

export type ConnectionStatePayload = {
  state: ConnectionState;
  reason?: string;
  timestamp: string;
};

export type OrderBookLevel = {
  price: string | number;
  size: string | number;
  count: number;
};

export type OrderBookUpdatePayload = {
  symbol: string;
  timestamp: string;
  l2_bids: OrderBookLevel[];
  l2_asks: OrderBookLevel[];
  l3_supported: boolean;
};
