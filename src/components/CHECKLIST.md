# Components Checklist (`src/components`)

## Mission

Implement reusable presentational components for high-frequency number rendering and UI composition.

## Must implement

- [ ] Number cell component with:
  - direction color flash (up/down),
  - animated transition for numeric changes.
- [ ] Reusable table/list primitives for watchlist and portfolio.
- [ ] Connection badge component (`connected`, `reconnecting`, `stale`).
- [ ] Asset header and compact detail cards for asset page.

## Performance directives

- Keep components pure and memoized where useful.
- Avoid broad parent re-renders for per-tick updates.
- Do not perform websocket/business calculations inside component render logic.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on non-performant UI proposals unless evidence shows they are acceptable.
- Prefer explicit props contracts over implicit global coupling.

## Definition of done

- Components are reusable across at least two pages.
- Per-tick updates remain smooth at target update rate.
