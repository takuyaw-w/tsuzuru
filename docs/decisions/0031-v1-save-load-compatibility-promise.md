# 0031: v1.0 Save / Load Compatibility Promise

## Status

Accepted

## Context

Tsuzuru now has layered save/load primitives:

- core `RuntimeSnapshot.version === 2`
- core `RuntimeSaveSlot.version === 1`
- adapter `RuntimeSaveData.version === 2` for Preact
- example-owned localStorage wrappers
- plugin-owned durable and one-shot state

ADR 0028 defines RuntimeSnapshot validation, ADR 0029 defines plugin
prepare-composition helpers, and ADR 0030 defines the RuntimeSaveSlot envelope.
The remaining v1.0 release question is what compatibility Tsuzuru promises and
what it deliberately does not promise.

Migration is not implemented. Scenario identity, scenario version, plugin state
shape, and host storage can all change in ways that make old save data unsafe to
load. v1.0 should therefore start with a validation / rejection promise instead
of a migration promise.

## Decision

For v1.0, Tsuzuru promises safe validation boundaries for current save/load
formats. It does not promise migration.

### Guaranteed in v1.0

`RuntimeSnapshot`:

- `version === 2` is the only supported snapshot version.
- malformed snapshots are rejected.
- old and future snapshot versions are rejected.
- validation is shallow at the snapshot boundary.
- plugin state deep validation is not a core responsibility.

`RuntimeSaveSlot`:

- `version === 1` is the only supported save slot envelope version.
- `scenarioId` is required.
- `scenarioVersion` is optional.
- scenario ID mismatches are rejected.
- scenario version mismatches are rejected when both the slot and current
  context provide a version.
- invalid nested `RuntimeSnapshot` payloads are rejected.
- validation returns a Result-style failure reason instead of restoring runtime
  state.

`RuntimeSaveData`:

- Preact adapter save data uses `version === 2`.
- Adapter save data contains a `RuntimeSnapshot` and the current renderable
  runtime event.
- Adapter save data does not own scenario identity, scenario version, storage,
  or migration.

Plugin state:

- durable plugin state may remain in runtime snapshots.
- one-shot plugin events must be cleared by plugin prepare helpers chosen by
  the host before snapshot creation.
- core does not automatically clear one-shot plugin events.
- core does not migrate or deep-validate plugin state.

Examples:

- `examples/preact-basic` filters invalid save slots, scenario mismatches, and
  invalid nested snapshots before runtime restore.
- example storage remains example-owned.
- invalid save slots may be silently filtered from loadable UI.

### Not Guaranteed in v1.0

Migration is not part of the v1.0 promise:

- no RuntimeSnapshot v1 -> v2 migration framework
- no RuntimeSaveSlot v0 -> v1 migration framework
- no adapter RuntimeSaveData migration framework beyond existing
  example-local compatibility code
- no plugin state migration framework
- no scenario version migration framework
- no host localStorage / IndexedDB / remote storage migration framework

Scenario and runtime compatibility are intentionally limited:

- save data compatibility after scenario content changes is not guaranteed.
- scenario ID mismatches are not loadable.
- scenario version mismatches are not loadable when both sides specify a
  version.
- compatibility across arbitrary runtime state or runtime event shape changes is
  not guaranteed.

UI behavior is also limited:

- user-facing invalid save slot reason UI is not part of the v1.0 promise.
- examples may keep invalid slot handling to filtering and disabled load
  actions.

## Rationale

The existing implementation already has strong validation and rejection tests.
Promising migration now would require a broader design for scenario identity,
scenario version migration, plugin state evolution, adapter save data evolution,
and host storage migrations.

A validation / rejection promise is safer for v1.0:

- invalid JSON-derived data does not reach runtime restore.
- old and future versioned payloads fail predictably.
- core remains independent from browser storage and UI policy.
- plugin one-shot cleanup stays with plugins and host save preparation.
- future migration can be designed explicitly instead of inferred from v1.0
  behavior.

## Consequences

### Positive

- Hosts get clear current-format validation behavior.
- RuntimeSnapshot, RuntimeSaveSlot, and RuntimeSaveData responsibilities are
  separated.
- Scenario mismatch handling is explicit.
- Plugin state and one-shot cleanup boundaries remain intact.
- v1.0 does not overpromise compatibility across scenario or runtime changes.

### Negative

- Games that need long-lived saves across scenario or runtime upgrades must
  build their own migration policy for now.
- Invalid save slot UI remains minimal unless a host or example implements
  detailed reason display.
- Existing example-local migration should not be mistaken for a general Tsuzuru
  migration framework.

## Reconsideration Criteria

Revisit this decision when:

- Tsuzuru introduces a formal save data migration framework.
- RuntimeSnapshot, RuntimeSaveSlot, or RuntimeSaveData moves to a new version.
- Standard plugins define versioned plugin state migration hooks.
- Hosts need a shared Result-style restore helper that maps validation failures
  and restore errors to UI messages.
- Scenario version migration becomes a first-class feature.

## Related Documents

- `docs/architecture.md`
- `docs/decisions/0028-runtime-snapshot-compatibility.md`
- `docs/decisions/0029-host-facing-save-load-helper.md`
- `docs/decisions/0030-runtime-save-slot-envelope.md`
- `docs/plans/v1.0-release-gate.md`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/src/runtime-save-slot.ts`
- `packages/preact/src/runtime-save.ts`
- `examples/preact-basic/src/game-storage.ts`
