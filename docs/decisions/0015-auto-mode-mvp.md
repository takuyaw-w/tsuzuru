# 0015 Auto Mode MVP

Status: accepted.

## Context

`examples/dsl-v2-basic` now demonstrates title, save/load, backlog, gallery,
settings, text reveal, and text preferences. A minimal Auto Mode is the next
presentation behavior needed to make the example feel closer to a playable
visual novel.

Auto Mode affects when the host asks the runtime to advance after a message is
fully visible. It does not change scenario execution, runtime state, choices,
jumps, conditions, plugin commands, or save/restore primitives.

## Decision

Auto Mode starts in `examples/dsl-v2-basic` as a host-owned presentation
controller.

The runtime menu exposes an `Auto` toggle. When enabled, the example waits for
the current narration or dialogue text to be fully visible, waits a fixed delay,
and then calls the existing runtime advance path.

Choices are never auto-selected. Auto Mode can remain enabled while a choice is
visible, but it pauses until the player selects an option.

The public APIs of `@tsuzuru/core`, `@tsuzuru/preact`, and
`@tsuzuru/standard-ui-preact` are unchanged.

## Rationale

Auto Mode is presentation timing policy. The host already owns text reveal
preferences, overlays, retained choice messages, and runtime menu behavior, so
it has the context needed to decide whether auto advance is currently allowed.

Keeping the first implementation in the example avoids adding engine-level
state before adjacent behavior is designed. Auto speed preferences, skip mode,
read tracking, and message history persistence all affect how a reusable
automation model should work.

The fixed delay keeps the MVP easy to reason about and avoids adding another
settings surface before the basic behavior is proven.

## Responsibility boundaries

### `@tsuzuru/core`

Owns runtime execution, runtime state, choices, jumps, conditions, plugin
command dispatch, and snapshot / restore primitives.

Does not own Auto Mode state, auto speed preferences, overlay policy, browser
storage, or automatic choice selection.

### `@tsuzuru/preact`

Owns the `useRuntime` adapter and exposes runtime state, `visibleEvent`, and
advance functions to host UI code.

Does not own a public Auto Mode API for this MVP.

### `@tsuzuru/standard-ui-preact`

Owns reusable UI components and text reveal helpers.

Does not own Auto Mode state, settings, or automatic advance policy.

### Host app / example

Owns:

- the Auto Mode toggle
- deciding when overlays pause auto advance
- waiting for text reveal completion
- applying the fixed auto advance delay
- preserving manual click, Enter, and Space behavior while Auto Mode is enabled

## Current limitations

- The auto advance delay is fixed.
- Auto Mode state is not persisted.
- Auto Mode state is not stored in save data.
- Auto speed preference is out of scope.
- Skip mode is out of scope.
- Read tracking is out of scope.
- Choices are not auto-selected.

## Future work

- Decide whether generated projects should include Auto Mode by default.
- Add host-owned auto speed preferences if the example needs them.
- Design skip mode together with read tracking.
- Revisit reusable standard UI helpers only after the host policy is clearer.
