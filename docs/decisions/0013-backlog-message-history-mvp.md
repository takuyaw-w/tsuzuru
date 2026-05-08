# 0011 Backlog / Message History MVP

Status: accepted.

## Context

After the Save / Load MVP, `examples/dsl-v2-basic` needed a minimal Backlog
screen that displays messages the player has already seen.

Tsuzuru already exposes renderable runtime events through `@tsuzuru/preact`'s
`useRuntime`. Narration and dialogue events are enough to build a first message
history for the example without changing core runtime state or public adapter
APIs.

## Decision

Backlog / Message History MVP starts as host-owned presentation state in
`examples/dsl-v2-basic`.

The example records `narration` and `dialogue` visible events during runtime and
renders them through the existing Backlog screen. The implementation does not
record choices, waits, page breaks, stops, ends, plugin commands, scene events,
jumps, state updates, or conditional wrapper events.

The public APIs of `@tsuzuru/core`, `@tsuzuru/preact`, and
`@tsuzuru/standard-ui-preact` are unchanged.

Backlog entries are not included in `RuntimeSaveData` yet.

## Rationale

Backlog is presentation behavior, not core narrative flow. The first
implementation only needs to prove that the host app can observe visible
message events and keep a readable history for the current runtime session.

Keeping the history in the example avoids adding message-history policy to
`@tsuzuru/core` before adjacent features are designed. Read tracking, skip mode,
auto mode, voice replay, and message-history persistence all affect what a
production history model should contain.

The MVP also keeps `@tsuzuru/preact` focused on runtime orchestration. The
adapter already exposes `visibleEvent`; adding a public history API would be
premature while the expected persistence and UI behavior are still unsettled.

## Responsibility boundaries

### `@tsuzuru/core`

Owns runtime execution and event production.

Does not own Backlog UI, message-history storage, read tracking, or persistence
policy for presentation history.

### `@tsuzuru/preact`

Owns the `useRuntime` adapter and exposes `visibleEvent` to host UI code.

Does not own a public backlog API, history persistence, or host screen behavior
for this MVP.

### `@tsuzuru/standard-ui-preact`

Owns reusable UI components.

Does not own Backlog behavior or message-history state.

### Host app / example

Owns:

- observing visible narration and dialogue events
- storing current-session message history
- rendering the Backlog screen
- deciding whether and how history is persisted later

## Current limitations

- Backlog only exists for the current runtime session.
- Backlog is not stored in save data.
- Loading a save does not restore previous backlog entries.
- The retained message behind a visible choice remains separate presentation
  state and is not restored through Backlog yet.
- There is no read tracking.
- There is no skip mode.
- There is no auto mode.
- There is no voice replay from Backlog.

## Future work

- Decide whether message history belongs in a host-owned persistence adapter,
  a future standard UI helper, or a core-adjacent document model.
- Integrate message history with save data migration and scenario identity.
- Design read tracking.
- Design skip mode.
- Design auto mode.
- Decide how Backlog should interact with voice replay.
- Persist presentation state needed to restore retained messages behind choices.
- Consider a reusable standard UI Backlog component without moving behavior or
  storage ownership out of the host app.
