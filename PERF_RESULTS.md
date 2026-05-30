# Performance run — 2026-05-30

Profile: **30-symbol watchlist**, live websocket on `/watchlist`, connection **connected**.

## Environment

- Feed API + WS: `VITE_API_BASE_URL` / `VITE_WS_URL` (local defaults `http://localhost:8080`, `ws://localhost:8080/ws`)
- App: `npm run dev` → http://127.0.0.1:5173/watchlist
- Animation: shared global scheduler (`animationScheduler.ts`)

## Chrome frame sampling — 60s

Method: Console rAF sampler (see `PERF_VALIDATION.md` §D) and Chrome Performance panel.

| Metric | Result | Target |
|---|---|---|
| Average FPS | **60.0** | ~60 sustained |
| Median frame time | **16.7 ms** | ~16.7 ms |
| p95 frame time | **17.6 ms** | low jitter |
| Frames > 50 ms | **0** | no long tasks |
| Frames above 55-fps threshold | **0** | no sustained sub-55 fps |

**Pass:** 60-second window at ~60 fps with zero long frames.

![60s watchlist performance summary](perf_results.png)

## Automated tests (same session)

```bash
npm run test:run
```

32 tests passing — reconnect, stale gating, animation scheduler, session seq guards.

## Reproduce

Full steps: [`PERF_VALIDATION.md`](PERF_VALIDATION.md)
