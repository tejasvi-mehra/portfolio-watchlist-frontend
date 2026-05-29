# Domain Checklist (`src/domain`)

## Mission

Own business models and pure calculations (P&L, totals, formatting decisions), independent of UI and transport.

## Must implement

- [ ] Typed models for:
  - watchlist quotes
  - portfolio positions
  - orderbook depth
- [ ] Pure functions for:
  - unrealized P&L
  - total portfolio value
  - day change calculations
- [ ] Deterministic handling for missing/late tick data.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on stateful or side-effectful business calculations.
- Keep all functions deterministic and unit-testable.
- Prefer decimal-safe arithmetic for production-grade financial outputs.

## Definition of done

- Domain logic has no React/websocket imports.
- All core calculations can be tested with static inputs.
