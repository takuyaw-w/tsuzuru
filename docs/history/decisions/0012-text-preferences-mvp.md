# 0012 Text Preferences MVP

Status: accepted.

## Context

`examples/preact-basic` already had a Settings screen, but it was placeholder UI.
The text reveal checkbox and related controls were not connected to runtime
presentation behavior.

The standard UI package already exposes `useTextReveal` options for enabling
text reveal and setting reveal speed, so the example can wire a first text
preferences flow without changing engine or adapter APIs.

## Decision

Text preferences start as host-owned preferences in `examples/preact-basic`.

The example stores:

- whether text reveal is enabled
- the text reveal speed in characters per second

The runtime message layer uses the existing `useTextReveal` options:

- `enabled`
- `charactersPerSecond`

Preferences are persisted with example-side localStorage under an
example-specific key. This localStorage persistence is not an engine-wide
storage policy.

The public APIs of `@tsuzuru/preact` and `@tsuzuru/standard-ui-preact` are
unchanged.

## Rationale

Text reveal and text speed are presentation preferences. They affect how the
host app displays message text, but they do not change scenario execution,
runtime state, choices, jumps, conditions, plugin commands, or save/restore
primitives.

Keeping these preferences in the example preserves the current boundary:
`@tsuzuru/core` owns narrative runtime behavior, while the host app owns local
presentation policy and browser persistence decisions.

Using `useTextReveal`'s existing options proves the current UI hooks are enough
for a minimal preferences flow before introducing any reusable settings API.

## Responsibility boundaries

### `@tsuzuru/core`

Owns runtime execution and runtime state.

Does not own text reveal preferences, browser storage, or localStorage policy.

### `@tsuzuru/preact`

Owns runtime orchestration through `useRuntime`.

Does not own text preference state or new public settings APIs for this MVP.

### `@tsuzuru/standard-ui-preact`

Owns reusable UI helpers such as `useTextReveal` and message components.

Does not own the example's preference storage, Settings screen flow, or
engine-wide preference policy.

### Host app / example

Owns:

- Settings screen state
- text reveal enabled/disabled preference
- text speed preference
- localStorage persistence for these preferences
- wiring preferences into `useTextReveal`

## Current limitations

- Preferences are not stored in save data.
- Preferences are local to `examples/preact-basic`.
- localStorage is synchronous and example-specific.
- Audio volume, BGM volume, SE volume, and voice volume are out of scope.
- Auto mode, skip mode, and read tracking are out of scope.

## Future work

- Decide whether reusable preference helpers belong in standard UI, a host app
  template, or dedicated docs.
- Design audio-related preferences separately.
- Design auto mode and skip mode together with read tracking.
- Decide how generated projects should opt into preference persistence.
