# 0028: RuntimeSnapshot Compatibility

## Status

Accepted

## Context

Tsuzuru core exposes `createRuntimeSnapshot(state)` and
`restoreRuntimeState(snapshot)` as the low-level runtime snapshot / restore
primitives.

`RuntimeSnapshot` is currently versioned as `version: 2`. TypeScript callers can
pass a `RuntimeSnapshot`, but real save/load boundaries usually deserialize JSON
from localStorage, files, or host-defined save slots. That data is effectively
`unknown` at runtime even when the TypeScript call site casts it to
`RuntimeSnapshot`.

Before this decision, `restoreRuntimeState` trusted the provided value. It did
not check `version`, did not reject old or future snapshots, and could either
accept malformed payloads or fail with incidental JavaScript errors.

## Decision

`RuntimeSnapshot.version === 2` is the only supported core snapshot format.

`restoreRuntimeState(snapshot: RuntimeSnapshot)` keeps its public signature and
return type, but it performs runtime validation before cloning the snapshot into
`RuntimeState`.

The restore policy is:

- `version === 2` is accepted.
- missing or non-number `version` is rejected.
- `version < 2` is rejected as an unsupported old snapshot.
- `version > 2` is rejected as an unsupported future snapshot.
- malformed snapshot payloads are rejected by throwing `Error`.
- error messages use the prefix `Invalid RuntimeSnapshot:`.

The validation is intentionally shallow at the snapshot boundary. Core validates
the outer runtime snapshot shape:

- `pointer`
- `variables`
- `plugins`
- `branchFrames`
- `pendingChoice`
- `pendingWait`
- `isStopped`
- `isWaitingForClick`

Core does not deep-validate every `TzrInstruction` stored in branch frames or
pending choice bodies. Core also does not deep-validate plugin-owned state.
Plugin state remains plugin-owned data stored under runtime plugin state.

Core snapshot creation preserves plugin state as provided. It does not
automatically clear plugin one-shot events. Save-ready cleanup for plugins such
as std-audio and std-effect remains a plugin helper / host responsibility.

## Rationale

Keeping the existing public function signature avoids a breaking API change
while still protecting hosts that deserialize JSON and cast it to
`RuntimeSnapshot`.

Rejecting old and future versions is safer than attempting implicit migration.
Tsuzuru does not yet have a formal save data migration framework, and silent
best-effort restore could corrupt runtime progression, scenario variables, or
plugin state.

Shallow validation catches malformed save payloads at the trust boundary without
moving plugin semantics or instruction validation into `restoreRuntimeState`.
Instruction deep validation belongs to compiler/runtime document validation, and
plugin state validation belongs to plugins or host save/load policy.

## Consequences

### Positive

- Invalid JSON-derived snapshot payloads fail with clear restore errors.
- Old and future snapshot versions have explicit behavior.
- Existing TypeScript call sites can continue using `restoreRuntimeState`.
- Core does not take over plugin one-shot cleanup or plugin state semantics.

### Negative

- Hosts that previously passed malformed data may now get a thrown
  `Invalid RuntimeSnapshot` error.
- Hosts still need their own save slot wrapper policy for scenario identity,
  scenario version, user-facing error handling, and storage migration.
- There is still no host-facing `parseRuntimeSnapshot` or unified save/load
  helper.

## Reconsideration Criteria

Revisit this decision when:

- Tsuzuru introduces a formal save data migration framework.
- A host-facing `parseRuntimeSnapshot(value: unknown)` or save/load helper is
  designed.
- RuntimeSnapshot moves to a new version.
- Plugin snapshot serialization hooks are introduced.

## Related Documents

- `AGENTS.md`
- `docs/architecture.md`
- `docs/history/decisions/0014-save-load-mvp.md`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/tests/runtime-snapshot-compatibility.test.ts`
