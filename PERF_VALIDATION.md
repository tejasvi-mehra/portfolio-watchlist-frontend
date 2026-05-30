# Performance Validation

How to validate smooth UI under **30 symbols** at sustained tick load: animated numbers tween (not jump), direction flashes, and **~60 fps** for 60 seconds.

## Preconditions

1. Market feed reachable at `VITE_API_BASE_URL` / `VITE_WS_URL` with live upstream data (production URLs in `.env`, or local `http://localhost:8080` / `ws://localhost:8080/ws`).
2. This app running: `npm run dev`.
3. `.env` points at the feed (defaults: `ws://localhost:8080/ws`, `http://localhost:8080`).
4. Chrome DevTools available.

## A. Animated number behavior (manual)

1. Open `/watchlist` with the default 30-symbol list.
2. Watch **Last Price** cells during live ticks.
3. Confirm digits ease (not snap), green/red flash on change, correct direction after consecutive ticks.

## B. React render isolation (manual)

1. React DevTools Profiler → record on `/watchlist` for ~10s.
2. Confirm a single-symbol tick re-renders that row only, not all rows.

## C. Prove ~60 fps (Chrome Performance)

1. DevTools → **Performance** → enable Screenshots (optional).
2. Record **60 seconds** on `/watchlist` while connected and ticks are flowing.
3. Inspect **Frames** lane: median ~**16.7 ms**, no sustained sub-55 fps, no long task bursts.

Record: median frame ms, p95 frame ms, frames > 50 ms, pass/fail.

## D. Quantitative FPS (Console rAF sampler)

Alternative to flame-chart inspection. On `/watchlist` with connection **connected**, paste in the browser console:

```javascript
await new Promise((resolve) => {
  const frames = [];
  const start = performance.now();
  const durationMs = 60000;

  function tick(now) {
    frames.push(now);
    if (now - start < durationMs) {
      requestAnimationFrame(tick);
    } else {
      const deltas = frames.slice(1).map((t, i) => t - frames[i]);
      deltas.sort((a, b) => a - b);
      const median = deltas[Math.floor(deltas.length / 2)] ?? 0;
      const p95 = deltas[Math.floor(deltas.length * 0.95)] ?? 0;
      const avgFps = (frames.length / durationMs) * 1000;
      const longFrames = deltas.filter((d) => d > 50).length;
      const sub55 = deltas.filter((d) => d > 1000 / 55).length;

      console.table({
        avg_fps: avgFps.toFixed(1),
        median_frame_ms: median.toFixed(1),
        p95_frame_ms: p95.toFixed(1),
        frames_over_50ms: longFrames,
        frames_over_55fps_threshold: sub55,
        total_frames: frames.length,
      });
      resolve();
    }
  }

  requestAnimationFrame(tick);
});
```

Keep the tab **visible and focused** for the full 60 seconds.

**Pass (matches recorded run):** avg_fps ≈ 60, median_frame_ms ≈ 16.7, frames_over_50ms = 0.

## E. Dev-only frame timing marks

With `npm run dev`, the provider emits Performance API measure `realtime-frame-apply` (Timings lane in Performance panel).

## F. Automated tests (logic only)

```bash
npm run test:run
```

Does not replace browser profiling.

## G. Optional higher tick rate

If upstream ticks are sparse, use a busier feed deployment (production `VITE_WS_URL`) or a shorter batch interval on the feed service while profiling.
