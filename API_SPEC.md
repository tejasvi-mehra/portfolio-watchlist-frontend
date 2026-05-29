# Frontend API Spec

This file defines the frontend contract with backend endpoints and websocket messages.

## HTTP Consumption

### `GET /api/symbols`

Used by configuration and SOD/open-price mapping.

Expected shape:

```json
{
  "provider": "hyperliquid",
  "configured_mode": "all",
  "symbols": [
    {
      "symbol": "BTC",
      "open_price": "103245.5"
    }
  ]
}
```

Frontend usage:

- Builds symbol suggestions for configure page.
- Stores `open_price` by symbol for SOD comparison and day-change calculations.

## WebSocket Consumption

Endpoint: `GET /ws`

Envelope:

```json
{
  "version": 1,
  "type": "diff_batch",
  "payload": {}
}
```

## Client -> Server Messages

### `subscribe`

```json
{
  "version": 1,
  "type": "subscribe",
  "payload": {
    "symbols": ["BTC", "ETH"],
    "last_seen_seq": 0
  }
}
```

### `resume`

```json
{
  "version": 1,
  "type": "resume",
  "payload": {
    "symbols": ["BTC", "ETH"],
    "last_seen_seq": 1250
  }
}
```

### `unsubscribe`

```json
{
  "version": 1,
  "type": "unsubscribe",
  "payload": {}
}
```

### `subscribe_asset`

```json
{
  "version": 1,
  "type": "subscribe_asset",
  "payload": {
    "symbols": ["BTC"]
  }
}
```

### `unsubscribe_asset`

```json
{
  "version": 1,
  "type": "unsubscribe_asset",
  "payload": {
    "symbols": ["BTC"]
  }
}
```

## Server -> Frontend Messages

### `snapshot`

Applied as full state replacement and chart seed.

```json
{
  "version": 1,
  "type": "snapshot",
  "payload": {
    "seq": 200,
    "entries": [
      {
        "symbol": "BTC",
        "last_price": "103240.7",
        "updated_at": "2026-05-29T05:00:00Z",
        "provider": "hyperliquid"
      }
    ]
  }
}
```

### `diff_batch`

Applied only when `seq` is newer than `lastSeenSeq`.

```json
{
  "version": 1,
  "type": "diff_batch",
  "payload": {
    "seq": 201,
    "flushed_at": "2026-05-29T05:00:00.050Z",
    "diffs": [
      {
        "symbol": "BTC",
        "last_price": "103242.1",
        "updated_at": "2026-05-29T05:00:00.041Z"
      }
    ]
  }
}
```

### `connection_state`

```json
{
  "version": 1,
  "type": "connection_state",
  "payload": {
    "state": "connected",
    "reason": "market updates resumed",
    "timestamp": "2026-05-29T05:00:02Z"
  }
}
```

Supported states:

- `connected`
- `reconnecting`
- `stale`

### `orderbook_update`

```json
{
  "version": 1,
  "type": "orderbook_update",
  "payload": {
    "symbol": "BTC",
    "timestamp": "2026-05-29T05:00:03Z",
    "l2_bids": [{ "price": "103240.1", "size": "1.2", "count": 3 }],
    "l2_asks": [{ "price": "103241.0", "size": "0.9", "count": 2 }],
    "l3_supported": false
  }
}
```

Frontend usage:

- Orderbook tables in asset detail.
- Asset-detail connection badge requires fresh L2 stream activity.

## Frontend State Rules

- `watchlist[symbol].lastPrice` is the displayed mark in UI.
- Day change is always computed relative to `openPrices[symbol]` (SOD).
- Chart appends on every tick and adds 1-second carry-forward points when price is unchanged.
- `lastSeenSeq` is monotonic and rejects stale replay batches.
