# Pages Checklist (`src/pages`)

## Mission

Provide page-level composition for required views while delegating business logic to feature/domain/realtime layers.

## Must implement

- [ ] Watchlist page:
  - symbol, last, day change stream rendering,
  - 60fps-safe update behavior.
- [ ] Portfolio page:
  - positions, qty, avg cost, last, unrealized P&L, total value,
  - per-tick recompute from latest prices.
- [ ] Asset detail page:
  - `subscribe_asset` / `unsubscribe_asset` integration,
  - L2 orderbook depth presentation,
  - clear L3 unsupported handling if backend says `l3_supported=false`.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on page implementations that mix transport code with rendering logic.
- Keep pages thin and declarative; move heavy logic into features/domain.

## Definition of done

- All required routes render useful data and handle loading/empty/error states.
- Asset page correctly manages detail subscription lifecycle on enter/leave.
