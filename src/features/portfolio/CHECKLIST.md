# Portfolio Feature Checklist

## Must implement

- [ ] Render positions with qty, avg cost, last, unrealized P&L.
- [ ] Recompute P&L on every relevant tick.
- [ ] Render total portfolio value.
- [ ] Handle missing quote for held symbols deterministically.

## How to implement

- Keep position state separate from quote state.
- Compute derived P&L with pure domain functions.
- Use selectors for per-position updates to reduce rerender load.

## Strict directives

- Be factual, rigorous, strict.
- Push back on embedding calculation logic directly in JSX trees.
