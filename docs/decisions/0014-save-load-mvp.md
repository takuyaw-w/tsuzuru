# 0010 Save / Load MVP

Status: accepted.

## Context

Tsuzuru has reached a point where it can run as a minimal visual novel engine:
authors can write `.tzr` scenarios, compile them into runtime documents, and run
them through the browser-first example UI.

The next practical requirement was a Save / Load MVP. The goal was not to design
a complete storage subsystem. It was to verify that an application can persist
and restore runtime progress using the existing `RuntimeSnapshot` and
`RuntimeSaveData` primitives.

Persistence is intentionally owned by the host application. `@tsuzuru/core`,
`@tsuzuru/preact`, and `@tsuzuru/standard-ui-preact` do not own browser storage
or save slot policy.

## Decision

`examples/preact-basic` now includes a localStorage-based Save / Load MVP.

The implementation uses:

- three fixed save slots: `slot-1`, `slot-2`, and `slot-3`
- `RuntimeSaveData` as the persisted runtime data
- an example-level scenario identity wrapper around `RuntimeSaveData`
- Title Continue behavior that restores the latest saved slot
- runtime Save / Load / Settings / Backlog overlays so `RuntimeApp` is not
  unmounted while opening those screens

Only Title returns to the parent title screen and discards the current runtime.

The public APIs of `@tsuzuru/core`, `@tsuzuru/preact`, and
`@tsuzuru/standard-ui-preact` were not changed for this MVP.

## Rationale

The first Save / Load implementation is primarily a restore-flow check. It
answers whether compiled runtime state can be captured, persisted by an
application, and restored into the running Preact adapter.

The current save data is small JSON. For the example MVP, localStorage is
sufficient and keeps the behavior synchronous and easy to inspect.

IndexedDB would introduce transactions, schema versioning, and async control
flow before Tsuzuru has a settled storage adapter design. That would blur the
purpose of `examples/preact-basic`, which is to demonstrate the current DSL and
runtime integration rather than a production save backend.

Keeping persistence in the example makes it easier to replace later with
IndexedDB, cloud save, file save, or Electron-specific storage without changing
core runtime semantics.

## Responsibility boundaries

### `@tsuzuru/core`

Owns:

- runtime state
- runtime stepping
- snapshot / restore primitives

Does not own:

- browser storage
- save slots
- localStorage, IndexedDB, cloud storage, or file storage
- UI presentation state

### `@tsuzuru/preact`

Owns:

- `RuntimeSaveData`
- `createSaveData`
- `restoreSaveData`
- lightweight validation through `isRuntimeSaveData`
- adapter-level restore wiring for Preact runtime state

Does not own:

- storage backend selection
- save slot management
- application-level Continue policy
- save/load screens

### `@tsuzuru/standard-ui-preact`

Owns reusable UI components.

Does not own save/load behavior, storage policy, or save slot state.

### Host app / example

Owns:

- save slot management
- storage backend selection
- load screen and save screen behavior
- Title Continue behavior
- UI-specific presentation state

For the current example, the selected storage backend is localStorage.

## Current implementation

The MVP lives in `examples/preact-basic`.

`src/game.ts` stores save slots under the example-specific key
`tsuzuru:example-preact-basic:saves:v1`. It reads localStorage defensively:
invalid JSON, old data, unknown slot IDs, and values that fail
`isRuntimeSaveData()` are ignored instead of crashing the app.

The current example save wrapper is `ExampleSaveData.version: 3`. New saves
include a `RuntimeSaveSlot` envelope with this scenario identity:

```ts
{
  id: "tsuzuru.example.preact-basic",
  version: "1"
}
```

When loading slots, `version: 2` payloads must match both the current scenario id
and scenario version. Mismatched slots are treated as unavailable load slots and
are not considered by Continue, so `runtime.restoreSaveData()` is not called for
data from another scenario or scenario version. Compatible `version: 2` payloads
are migrated into the current v3 wrapper.

Older `ExampleSaveData.version: 1` payloads and legacy raw `RuntimeSaveData`
payloads do not carry scenario identity. The browser localStorage example
migrates those payloads as current-scenario saves and attaches the current
identity. Invalid JSON and malformed payloads are still ignored without throwing.

This migration logic is an example-level MVP. It does not introduce a formal
storage adapter, migration framework, or `@tsuzuru/config` schema field.

`src/screens/SaveScreen.tsx` and `src/screens/LoadScreen.tsx` render the three
fixed slots. Empty slots display `Empty`. Load and Delete are enabled only for
saved slots. Save can overwrite an existing slot without confirmation.

`src/App.tsx` wires the flow:

- Start creates a new runtime with `initialSaveData = null` and
  `autoStart = true`.
- Continue selects the latest slot and starts the runtime with
  `autoStart = false`.
- Loading from the title screen starts the runtime from the selected save data.
- Loading during runtime calls `runtime.restoreSaveData(slot.data)` without
  unmounting `RuntimeApp`.
- Saving during runtime calls `runtime.createSaveData()` and writes the result
  through the example storage helper.

## Known limitations

When saving and loading while a choice is visible, the choice itself is restored,
but the previous message window retained behind the choice is not restored.

This is not runtime state corruption. The choice state is part of the restored
runtime data, but the retained previous message is example UI presentation state
held in `lastMessageEvent`. That presentation state is not part of
`RuntimeSaveData`.

The player can still select a choice and continue normally, so this is not a
blocker for the MVP.

Future work should treat this together with backlog, message history, and
presentation state persistence.

localStorage is only the current example implementation. It is not the formal
storage policy for Tsuzuru as a whole.

## Future work

- formal save data migration framework
- screenshot thumbnail
- quick save / quick load
- auto save
- IndexedDB adapter
- cloud save adapter
- file save / Electron save
- propagation to the `create-tsuzuru` template
- whether to provide a standard UI `SaveLoadPanel`
- integration with backlog and message history

## Consequences

### Positive

- The example demonstrates a real save/restore loop without expanding core
  runtime responsibilities.
- `@tsuzuru/preact` remains a runtime adapter rather than a storage framework.
- `@tsuzuru/standard-ui-preact` remains reusable UI, not application behavior.
- Future storage backends can be designed as adapters without undoing core or
  Preact API decisions.

### Negative

- localStorage is synchronous and limited, so it is not appropriate as a final
  storage recommendation.
- The example has save/load behavior that is not yet available in generated
  projects.
- Some presentation state, including the retained message behind choices, is not
  persisted yet.

## Related documents

- `docs/architecture.md`
- `docs/runtime.md`
- `examples/preact-basic/README.md`
- `examples/preact-basic/src/game.ts`
