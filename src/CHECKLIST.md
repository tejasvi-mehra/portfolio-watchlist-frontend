# Source Root Checklist (`src`)

## Mission

Provide cohesive architecture for a deployable MVP without overbuilding.

## MVP scope lock

- [ ] Watchlist screen with live updates.
- [ ] Portfolio screen with per-tick P&L recompute.
- [ ] Asset detail screen with dedicated orderbook stream (L2).
- [ ] Connection state handling (`connected`, `reconnecting`, `stale`).
- [ ] Reconnect reconciliation correctness.

## Strict directives from project context

- Be factual, rigorous, and strict.
- Push back on requests that weaken correctness/performance unless there is a provably better approach.
- Do not concede on architecture quality for speed if it introduces known correctness issues.

## Definition of done

- App is deployable, routes work, realtime contract integration path is complete.
- Non-MVP enhancements are explicitly deferred with rationale.
