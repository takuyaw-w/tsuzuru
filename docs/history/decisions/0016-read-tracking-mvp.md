# 0016 Read Tracking MVP

Status: accepted.

## Context

`examples/preact-basic` already demonstrates Backlog / Message History and Auto
Mode as host-owned presentation behavior. Skip Mode will need a way to know
which narration and dialogue messages have already been shown to the player.

Before designing Skip Mode or stable runtime event identity, the example needs a
minimal Read Tracking MVP that proves the host can observe visible message
events and keep a current-session read set.

## Decision

Read Tracking starts in `examples/preact-basic` as host-owned presentation
state.

The MVP tracks only `narration` and `dialogue` visible events. When either kind
of event becomes visible, the example marks it as read for the current
`RuntimeApp` session. It displays the current read count in the runtime UI and
shows a `Read` badge for read Backlog entries.

Read Tracking is not stored in core runtime state, `RuntimeSaveData`, or
localStorage.

The public APIs of `@tsuzuru/core`, `@tsuzuru/preact`, and
`@tsuzuru/standard-ui-preact` are unchanged.

## Rationale

Read Tracking is presentation and player-progress policy, not scenario
execution. Core should continue to own runtime stepping, choices, jumps,
conditions, plugin command dispatch, and snapshot / restore primitives.

The host app already observes `visibleEvent` for Backlog and Auto Mode, so it
can derive a current-session read set without adding package APIs.

Stable event identity is not designed yet. For the MVP, read keys are derived
from message content and all key generation is isolated in
`createReadEntryKey()` so future identity sources can replace it in one place.

Backlog and Read Tracking remain separate:

- `message-history.ts` stores display history for the Backlog UI.
- `game.ts` provides read key helpers and read checks.

They may be unified later if save data, source identity, or Skip Mode needs a
shared model.

## Responsibility boundaries

### `@tsuzuru/core`

Owns runtime execution and runtime state.

Does not own Read Tracking state, read key generation, read persistence, Skip
Mode policy, or browser storage.

### `@tsuzuru/preact`

Owns the `useRuntime` adapter and exposes `visibleEvent` to host UI code.

Does not own a public Read Tracking API for this MVP.

### `@tsuzuru/standard-ui-preact`

Owns reusable UI components and text reveal helpers.

Does not own read state, read badges, read count UI, or Skip Mode policy.

### Host app / example

Owns:

- observing visible narration and dialogue events
- deriving current-session read keys
- storing the read key set in RuntimeApp state
- showing read count and Backlog read badges
- deciding later whether read state should be persisted

## Current limitations

- Only narration and dialogue are read-trackable.
- Read keys are derived from message content.
- Repeated identical messages share the same read key.
- Read Tracking is current-session only.
- Read Tracking is not saved in `RuntimeSaveData`.
- Read Tracking is not persisted in localStorage.
- Messages are marked read when displayed, not when text reveal completes.
- Skip Mode is out of scope.

## Future work

- Design stable read identity from source location, instruction id, scenario
  identity, or compiled document metadata.
- Decide whether read state should be saved, migrated, or kept separately from
  runtime save data.
- Decide whether read should mean message display or full text reveal
  completion.
- Use Read Tracking as an input for Skip Mode.
- Revisit whether Backlog and Read Tracking should share a persisted
  presentation-state model.
