# Testing Checklist (`src/testing`)

## Mission

Define test strategy for realtime correctness, rendering smoothness, and reconnect reliability.

## Must implement

- [ ] Unit tests:
  - domain calculators
  - protocol reducers/parsers
- [ ] Integration tests:
  - snapshot + diff replay reconciliation
  - asset detail subscription lifecycle
- [ ] Performance checks:
  - 30 symbols at 5 Hz update path
  - no major UI jank under sustained updates

## Strict directives

- Be factual, rigorous, strict.
- Push back on unverified claims of smoothness or correctness.
- Tests must validate behavior, not implementation details.

## Definition of done

- Reconnect and stale-state regressions are covered by repeatable tests.
