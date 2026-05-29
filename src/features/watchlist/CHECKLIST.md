# Watchlist Feature Checklist

## Must implement

- [ ] Render 30+ live symbols with smooth updates.
- [ ] Show symbol, last, day change %.
- [ ] Direction flash + animated number transitions.
- [ ] Zero stale row behavior after reconnect snapshot/replay.

## How to implement

- Consume normalized quote state from realtime store selectors.
- Memoize row components and avoid parent list churn.
- Use windowing only if evidence shows it is needed.

## Strict directives

- Be factual, rigorous, strict.
- Push back on non-performant rendering patterns.
