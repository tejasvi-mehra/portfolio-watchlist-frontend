# Realtime Checklist (`src/realtime`)

## Mission

Own websocket transport, protocol handling, reconnect strategy, and state reconciliation behavior.

## Must implement

- [ ] WS connection lifecycle:
  - initial `subscribe`/`resume`,
  - reconnect with last-seen sequence,
  - stale detection fallback handling.
- [ ] Protocol handlers for:
  - `snapshot`
  - `diff_batch`
  - `connection_state`
  - `orderbook_update`
- [ ] Asset detail controls:
  - `subscribe_asset`
  - `unsubscribe_asset`
- [ ] Replay/snapshot reconcile logic that prevents stale/zombie state after background return.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on any approach that violates ordering or replay correctness.
- Never mix transport concerns with presentational UI concerns.
- Prefer explicit state transitions and deterministic reducers.

## Definition of done

- Reconnect + replay path is deterministic and testable.
- No duplicate ticker state after reconnect.
- Asset detail stream subscriptions are correctly cleaned up on route changes.
