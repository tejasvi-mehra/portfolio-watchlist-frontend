# Asset Detail Feature Checklist

## Must implement

- [ ] On page entry, send `subscribe_asset` for symbol.
- [ ] On page exit, send `unsubscribe_asset` for symbol.
- [ ] Render L2 bids/asks from `orderbook_update`.
- [ ] Respect backend `l3_supported` flag and message it clearly when false.

## How to implement

- Manage subscription lifecycle via effect hooks tied to route symbol.
- Keep orderbook state keyed by symbol with timestamp freshness checks.
- Avoid rendering full table rerenders when only a few levels change.

## Strict directives

- Be factual, rigorous, strict.
- Push back on claiming L3 if backend contract says L2 only.
