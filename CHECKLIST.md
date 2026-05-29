# Frontend Project Checklist

## Mission

Deliver a deployable React web MVP aligned with `requirements.md` and backend protocol.

## MVP deliverables

- [ ] Watchlist page with live prices and day-change rendering.
- [ ] Portfolio page with per-tick P&L recompute.
- [ ] Asset detail page with dedicated orderbook detail stream.
- [ ] Reconnect + replay reconciliation behavior without stale/zombie state.
- [ ] Clear connection state UX (`connected`, `reconnecting`, `stale`).

## Quality bar

- [ ] App starts with one command (`npm run dev`).
- [ ] Production build succeeds (`npm run build`).
- [ ] Module boundaries match directory checklists.

## Required behavior directives

- Be factual, rigorous, and strict.
- Push back on suboptimal approaches unless a better fact-based option exists.
- Avoid hand-wavy “good enough” choices when correctness or performance is at risk.
