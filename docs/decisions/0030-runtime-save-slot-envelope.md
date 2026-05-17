# 0030: Runtime Save Slot Envelope

## Status

Accepted

## Context

`RuntimeSnapshot` is the low-level core runtime state format. ADR 0028 defines
its compatibility policy, and ADR 0029 adds
`prepareRuntimeStateForSnapshot(state, prepares)` so hosts can compose
plugin-specific save-ready preparation before snapshot creation.

Those APIs still leave the outer save slot policy undefined. A host save slot
usually needs information that does not belong inside `RuntimeSnapshot`:

- save data version
- scenario identity
- scenario version
- display metadata such as creation time and labels
- user-facing reasons for rejecting a saved slot

`examples/preact-basic` already has an example-owned envelope with scenario
identity. The project now needs a shared core definition for the minimum
envelope validation policy without taking over storage, migration, or restore
UI behavior.

The Preact basic example now uses `RuntimeSaveSlot` inside its example-specific
save payload. That wrapper still owns retained message presentation state and
localStorage persistence, while `validateRuntimeSaveSlot` owns scenario identity
and nested snapshot validation.

The Vue basic example also uses `RuntimeSaveSlot` for a smaller save/load
foundation. Its storage remains example-owned, and the example uses Vue
`RuntimeSaveData` for adapter-facing restore behavior.

## Decision

Core defines a host-facing save slot envelope:

```ts
export interface RuntimeSaveSlot {
  readonly version: 1;
  readonly scenarioId: string;
  readonly scenarioVersion?: string;
  readonly createdAt: string;
  readonly snapshot: RuntimeSnapshot;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

`RuntimeSaveSlot.version` is the envelope version. It is separate from
`RuntimeSnapshot.version`.

Core also provides a Result-style validation helper:

```ts
export interface RuntimeSaveSlotContext {
  readonly scenarioId: string;
  readonly scenarioVersion?: string;
}

export function validateRuntimeSaveSlot(
  value: unknown,
  context: RuntimeSaveSlotContext,
): RuntimeSaveSlotValidationResult;
```

The helper validates the envelope shape, checks the envelope version, compares
scenario identity against the provided context, and validates the nested
`RuntimeSnapshot`. It does not restore runtime state for the caller and does not
create or migrate save data.

Validation failures return one of these reasons:

- `invalid_slot`
- `unsupported_slot_version`
- `scenario_id_mismatch`
- `scenario_version_mismatch`
- `invalid_snapshot`

## Policy

### Envelope Version

`RuntimeSaveSlot.version === 1` is the only supported envelope version.

Missing, non-number, old, or future envelope versions are rejected with
`unsupported_slot_version`. This is distinct from nested `RuntimeSnapshot`
version errors, which are reported as `invalid_snapshot`.

Migration is not implemented by this decision.

### Scenario Identity

`scenarioId` is required and must be a non-empty string.

The host passes the current `scenarioId` through `RuntimeSaveSlotContext`.
Mismatched scenario IDs are rejected with `scenario_id_mismatch`. Core does not
derive scenario identity from the runtime document; the host or adapter chooses
the identity policy.

### Scenario Version

`scenarioVersion` is optional.

When both the slot and context provide a scenario version, they must match.
Mismatches are rejected with `scenario_version_mismatch`. Missing
`scenarioVersion` remains valid so hosts can support simple projects or older
envelopes that do not use scenario version checks.

Migration across scenario versions is not implemented by this decision.

### Display Metadata

`createdAt` is a required string intended to contain an ISO timestamp.

`label` is an optional display string.

`metadata` is an optional object for host-defined display or indexing data. Core
validates only that it is an object. Core does not deep-validate metadata and
metadata does not affect restore semantics.

### Snapshot

The nested `snapshot` must be a valid `RuntimeSnapshot` according to ADR 0028.
Invalid nested snapshots return `invalid_snapshot`.

Plugin state deep validation remains plugin or host responsibility. Core does
not automatically clear plugin one-shot events when validating a save slot.

## Rationale

A Result-style validation helper is better suited to host UI than the
low-level `restoreRuntimeState` throw API. Hosts can distinguish invalid save
slot data from scenario mismatches and from invalid nested snapshots without
running a restore flow.

Keeping this helper validation-only avoids taking over browser storage,
migration, save slot creation, user-facing copy, or framework adapter restore
behavior.

## Consequences

### Positive

- Save slot versioning is separated from runtime snapshot versioning.
- Scenario ID and scenario version mismatch behavior is explicit.
- Hosts get stable failure reasons for load-screen and Continue decisions.
- Core still does not own storage, migration, plugin one-shot cleanup, or
  plugin state semantics.

### Negative

- Hosts still need to create save slots and choose storage backends.
- Hosts still need their own migration strategy if save data or scenario
  versions change.
- `createdAt` is validated as a string only; stricter timestamp validation is
  left to hosts.

## Reconsideration Criteria

Revisit this decision if:

- Tsuzuru introduces a formal save data migration framework.
- Framework adapters need a shared `createRuntimeSaveSlot` helper.
- Hosts need a shared Result-style restore helper that maps validation failures
  and `restoreRuntimeState` errors into UI-facing outcomes.
- Core starts carrying scenario identity in compiled runtime documents.

## Related Documents

- `docs/architecture.md`
- `docs/decisions/0014-save-load-mvp.md`
- `docs/decisions/0018-retained-message-save-load.md`
- `docs/decisions/0028-runtime-snapshot-compatibility.md`
- `docs/decisions/0029-host-facing-save-load-helper.md`
- `packages/core/src/runtime-save-slot.ts`
- `packages/core/tests/runtime-save-slot.test.ts`
