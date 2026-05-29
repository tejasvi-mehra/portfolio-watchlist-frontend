# Config Checklist (`src/config`)

## Mission

Centralize environment and runtime configuration with strict validation.

## Must implement

- [ ] Typed config surface for all runtime env vars.
- [ ] Fail-fast validation when required vars are missing.
- [ ] Safe defaults only where they cannot hide production mistakes.
- [ ] Clear mapping between README env docs and actual runtime checks.

## Strict directives

- Be factual, rigorous, and strict.
- Push back on "silent default" behavior for critical transport settings.
- Never read `import.meta.env` directly outside this directory.

## Definition of done

- App cannot boot with invalid critical config.
- Env contract is explicit and discoverable.
