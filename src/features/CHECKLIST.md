# Features Checklist (`src/features`)

## Mission

Implement user-facing product behavior by composing domain logic + realtime state + components.

## Must implement

- [ ] Keep each feature isolated:
  - watchlist
  - portfolio
  - asset-detail
  - connection-state
- [ ] Define feature-local selectors/hooks to avoid broad rerenders.
- [ ] Keep transport parsing out of feature render logic.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on cross-feature coupling unless there is strong evidence it reduces complexity.
- Favor composable feature modules over giant page-level logic files.

## Definition of done

- Each feature can be developed/tested independently.
- Feature APIs are explicit and stable.
