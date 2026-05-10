# 0017 Skip Mode MVP

Status: accepted.

## Context

`examples/preact-basic` now has Save / Load, Backlog / Message History, Text
Preferences, Auto Mode, and Read Tracking MVPs. Skip Mode is the next
presentation behavior needed to let players move quickly through narration and
dialogue they have already seen.

Read Tracking currently marks narration and dialogue as read when the message
becomes visible. That means Skip Mode cannot decide only from the current
`isRead()` result, because a first-time message becomes read during the same
display. The host must distinguish messages that were already read before
display from messages that just became read.

## Decision

Skip Mode starts in `examples/preact-basic` as a host-owned presentation
controller.

The runtime menu exposes a `Skip` toggle. When enabled, the example advances
only visible narration and dialogue whose read key was already present before
that visible event was recorded as read. First-time messages are not skipped
during the same display. Choices are never selected automatically.

Skip Mode uses current-session Read Tracking. It is not stored in core runtime
state, `RuntimeSaveData`, or localStorage.

The public APIs of `@tsuzuru/core`, `@tsuzuru/preact`, and
`@tsuzuru/standard-ui-preact` are unchanged.

## Rationale

Skip Mode is presentation policy. The host owns overlays, runtime menu state,
text reveal behavior, Auto Mode timing, and Read Tracking, so it has the
necessary context to decide whether automatic advance should be allowed.

Keeping the MVP in the example avoids adding engine-level skip state before
stable read identity, persisted read state, skip speed preferences, and standard
UI expectations are designed.

Skip Mode takes priority over Auto Mode in the MVP. When Skip Mode is enabled,
the example suppresses Auto Mode's automatic timer and uses the Skip Mode timer
only when the current message was previously read. This keeps the first
implementation predictable while preserving manual click, Enter, and Space
behavior.

## Responsibility boundaries

### `@tsuzuru/core`

Owns runtime execution, runtime state, choices, jumps, conditions, plugin
command dispatch, and snapshot / restore primitives.

Does not own Skip Mode state, read tracking state, skip speed, automatic choice
selection, browser storage, or skip persistence.

### `@tsuzuru/preact`

Owns the `useRuntime` adapter and exposes runtime state, `visibleEvent`, and
advance functions to host UI code.

Does not own a public Skip Mode API for this MVP.

### `@tsuzuru/standard-ui-preact`

Owns reusable UI components and text reveal helpers.

Does not own Skip Mode state, Read Tracking state, or automatic advance policy.

### Host app / example

Owns:

- the Skip Mode toggle
- checking whether the current message was read before display
- revealing previously read text immediately while skipping
- applying the fixed skip advance delay
- pausing skip while overlays or choices are visible
- keeping Skip Mode state and Read Tracking out of save data

## Current limitations

- Skip Mode only applies to narration and dialogue.
- Skip Mode uses current-session Read Tracking only.
- Read identity depends on content-derived read keys.
- Repeated identical messages share the same read key.
- Read Tracking is not persisted in localStorage.
- Skip Mode state is not persisted.
- Skip Mode state is not stored in save data.
- Read Tracking state is not stored in save data.
- Choices are not auto-selected.
- Skip speed is fixed.
- Unread skip and force-skip-all behavior are out of scope.

## Future work

- Design stable read identity from source location, instruction id, scenario
  identity, or compiled document metadata.
- Decide whether read state should be persisted independently from runtime save
  data.
- Add skip speed preferences if the host UI needs them.
- Revisit whether generated projects should include Skip Mode by default.
- Revisit reusable standard UI helpers only after host policy is clearer.

## Related Documents

- `AGENTS.md`
- `docs/decisions/0015-auto-mode-mvp.md`
- `docs/decisions/0016-read-tracking-mvp.md`
- `examples/preact-basic/README.md`
