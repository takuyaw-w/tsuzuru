# 0029: Host-Facing Save / Load Helper

## Status

Accepted

## Context

Core exposes low-level runtime snapshot APIs:

- `createRuntimeSnapshot(state)`
- `restoreRuntimeState(snapshot)`

ADR 0028 defines the compatibility policy for `RuntimeSnapshot.version === 2`
and malformed restore payloads. That policy intentionally keeps core focused on
runtime state cloning and validation. It does not define a full host save slot
format, scenario identity checks, scenario version migration, browser storage,
or user-facing restore recovery.

Standard plugins may still need save-ready preparation before a snapshot is
created. For example, std-audio and std-effect own one-shot events that should
not be replayed after load, while durable plugin state should remain in the
snapshot.

Before this decision, hosts could call plugin prepare helpers directly, but
there was no shared core helper for composing multiple prepare steps before
`createRuntimeSnapshot`.

## Decision

Core provides a small host-facing preparation helper:

```ts
export type RuntimeSnapshotPrepare = (state: RuntimeState) => RuntimeState;

export function prepareRuntimeStateForSnapshot(
  state: RuntimeState,
  prepares?: readonly RuntimeSnapshotPrepare[],
): RuntimeState;
```

The helper applies host-provided prepare functions in order and returns the
prepared `RuntimeState`. Hosts can then call:

```ts
createRuntimeSnapshot(
  prepareRuntimeStateForSnapshot(state, [
    prepareStdAudioStateForSnapshot,
    prepareStdEffectStateForSnapshot,
  ]),
);
```

Core does not inspect plugin state semantics and does not automatically clear
plugin one-shot events. Plugin-specific prepare helpers remain plugin-owned, and
the host chooses which helpers to apply for its save slot policy.

Framework adapters may wrap this core helper when producing view-oriented
adapter save data. `@tsuzuru/preact` exposes
`createRuntimeSaveDataFromState(state, event, { prepares })` to apply the same
prepare chain and return adapter `RuntimeSaveData`. That wrapper remains below
the save slot boundary: it does not create `RuntimeSaveSlot`, choose scenario
identity, or own storage.

This decision does not introduce a save slot wrapper API. Scenario identity,
scenario version, save data versioning, migration, storage, and user-facing
restore errors remain host or framework-adapter policy for now.

## Rationale

This keeps the low-level snapshot API stable while reducing host-side glue for
the most immediate save-ready need: composing plugin prepare helpers.

The helper is intentionally small:

- It has no plugin-specific knowledge.
- It does not change `restoreRuntimeState`.
- It does not replace ADR 0028 validation.
- It leaves save slot compatibility policy outside core until the scenario
  identity and migration rules are more mature.

Adding a full `createRuntimeSaveSlot` / `restoreRuntimeSaveSlot` API now would
force decisions about scenario identity, scenario versioning, host storage, and
user-facing errors that are not yet stable.

## Consequences

### Positive

- Hosts get a standard composition point for plugin save-ready preparation.
- Core still does not own plugin one-shot semantics.
- Existing `createRuntimeSnapshot` and `restoreRuntimeState` call sites remain
  valid.
- The helper can be used by adapters, examples, and tests without coupling core
  to std plugins.

### Negative

- Hosts still need to design their own save slot envelope.
- Scenario identity and migration errors are still outside core.
- Plugin state deep validation remains plugin / host responsibility.

## Reconsideration Criteria

Revisit this decision if:

- Tsuzuru defines a formal save slot envelope with scenario identity and
  scenario version fields.
- A host-facing Result-based restore API is needed for UI error reporting.
- Plugins need a standardized registration mechanism for snapshot prepare hooks.
- Save data migration becomes part of core or a shared adapter package.

## Related Documents

- `docs/architecture.md`
- `docs/history/decisions/0014-save-load-mvp.md`
- `docs/history/decisions/0018-retained-message-save-load.md`
- `docs/history/decisions/0028-runtime-snapshot-compatibility.md`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/tests/runtime-snapshot-prepare.test.ts`
