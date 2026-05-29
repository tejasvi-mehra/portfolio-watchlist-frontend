# App Layer Checklist (`src/app`)

## Mission

Own application wiring only: providers, routing, and global composition. Do not leak domain logic into this directory.

## Must implement

- [ ] Route map for:
  - `/watchlist`
  - `/portfolio`
  - `/asset/:symbol`
- [ ] Global providers (realtime client, app-wide state container).
- [ ] Deterministic navigation defaults and safe fallback routes.
- [ ] Error boundary strategy for runtime WS failures.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on weak approaches; do not concede unless there is a clearly better factual alternative.
- Keep this layer thin. If business logic appears here, move it to feature/domain modules.
- No hidden side effects in route declarations.

## Definition of done

- App boots without runtime warnings.
- Routes are navigable directly via URL reload.
- Providers are initialized once and reused through route transitions.
