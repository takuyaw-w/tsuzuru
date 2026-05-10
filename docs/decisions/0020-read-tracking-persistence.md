# 0020: Read Tracking Persistence

## Status

Accepted

## Context

`examples/preact-basic` already tracks read narration and dialogue messages in
`RuntimeApp` state. Skip Mode uses that state to advance only messages that were
already read before the current display.

Because the state was in memory only, reloading the page or restarting the app
lost the read set. That made Skip Mode fall back to treating all messages as
unread after restart.

## Decision

`examples/preact-basic` persists Read Tracking to localStorage.

The stored data contains:

- `version: 1`
- the example scenario id and scenario version
- read entry keys for `narration` and `dialogue`

The storage key is separate from save slots:

```txt
tsuzuru:example-preact-basic:read-tracking:v1
```

Payloads with a mismatched scenario id or scenario version are ignored. Invalid
JSON, malformed payloads, unavailable localStorage, and storage write failures
fall back without crashing the app.

Scene tracking, choice tracking, gallery unlocks, achievements, and package
hook extraction are out of scope for this decision.

## Rationale

Read Tracking remains host-owned presentation and player-progress policy. It is
not part of core runtime execution and does not belong in `RuntimeSaveData` for
this example step.

Keeping Read Tracking separate from save slots lets Skip Mode preserve the
usual "skip already read text" behavior across reloads while keeping runtime
save/load focused on runtime progress.

The example uses the existing content-derived `createReadEntryKey()` keys so the
change stays small. Stable source-location identity can be designed later
without changing core or Preact APIs now.

## Consequences

### Positive

- Skip Mode can use previously persisted read narration and dialogue after a
  reload.
- Save slot data and Read Tracking data have independent storage keys and
  validation boundaries.
- Scenario id and version mismatches do not leak read state across scenario
  revisions.
- Core, Preact, standard UI, and plugin packages remain unchanged.

### Negative

- Read identity is still content-derived, so repeated identical messages share a
  read key.
- localStorage remains an example backend, not a production storage
  recommendation.
- Backlog history itself is still not persisted.

## Reconsideration Criteria

Revisit this decision when Tsuzuru has stable message identity, generated
project storage policy, or a package-level Read Tracking hook.

## Related Documents

- `AGENTS.md`
- `docs/decisions/0016-read-tracking-mvp.md`
- `docs/decisions/0017-skip-mode-mvp.md`
- `docs/plans/v0.11-read-tracking-persistence.md`
- `examples/preact-basic/src/read-tracking.ts`
