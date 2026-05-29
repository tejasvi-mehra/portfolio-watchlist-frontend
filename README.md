# Frontend (Web) - Live Portfolio Stream MVP

This is a React web app scaffold focused on MVP delivery for the requirements in `../requirements.md`.

## Scope for this scaffold

- Web app only (no React Native in this phase).
- Core screens:
  - Watchlist
  - Portfolio
  - Asset detail
- Realtime client layer and protocol contracts prepared for backend integration.
- Directory-local checklists so independent agents can implement safely by module.

## Why web-only now

For this assignment scope, web-first is the highest-confidence approach to ship quickly, validate realtime behavior, and keep deployment simple. Mobile-specific packaging can be added later without changing core domain/realtime modules.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

By default, the app expects a backend websocket endpoint from `.env`.

## Environment

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

Primary variable:

- `VITE_WS_URL` (example: `ws://localhost:8080/ws`)
- `VITE_API_BASE_URL` (example: `http://localhost:8080`)
- `VITE_CHART_POINT_INTERVAL_MS` (default `100`, lower = faster chart point updates)
- `VITE_CHART_MAX_POINTS` (default `120`)
- `VITE_CHART_CANDLE_WIDTH` (default `8`)
- `VITE_CHART_CANDLE_GAP` (default `6`)

## Build

```bash
npm run build
npm run preview
```

## Simple deployment options

### Option A: Vercel / Netlify (recommended)

- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_WS_URL` in deployment environment variables.

### Option B: Static container

- Build with `npm run build`
- Serve `dist` with any static web server (Nginx, Caddy, Cloudflare Pages, etc.).

## Required engineering behavior for all agents

- Be factual, rigorous, and strict.
- Push back on weak approaches; do not concede unless there is a clearly better factual option.
- Prefer deterministic, testable design over convenience hacks.
- Preserve wire efficiency and performance constraints from requirements.

