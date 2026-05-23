# @tsuzuru/standard-game-storage

Standard game storage helpers for Tsuzuru.

This package currently provides preferences, read tracking, and save slot
storage helpers. It also provides a standard runtime save adapter for hosts that
want the current `RuntimeSaveSlot` envelope while keeping runtime payload
validation caller-owned.

Primary APIs:

- `createStandardGameStorage`
- `createStandardGameStorageFromConfig`
- `StandardGameStoragePreset`
- `CreateStandardGameStorageOptions`
- `StandardGamePreferences`
- `DEFAULT_STANDARD_GAME_PREFERENCES`
- `STANDARD_GAME_TEXT_SPEED_OPTIONS`
- `normalizeStandardGamePreferences`

Advanced host APIs:

- `createLocalStoragePreferencesStore`
- `StandardReadTrackingState`
- `StandardReadTrackingProject`
- `isReadTrackableEvent`
- `createReadEntryKey`
- `createReadEntryKeyFromText`
- `createInitialReadTrackingState`
- `markRead`
- `isRead`
- `serializeReadTrackingState`
- `parseReadTrackingStorageData`
- `createLocalStorageReadTrackingStore`
- `createStandardRuntimeSaveAdapter`
- `StandardRuntimeSavePayload`
- `isStandardRuntimeSavePayload`
- `StandardRuntimeSaveAdapter`
- `StandardRuntimeSaveData`
- `StandardRetainedMessageEvent`
- `isStandardRetainedMessageEvent`
- `StandardSaveSlot`
- `StandardSaveSlotDefinition`
- `StandardSaveSlotStore`
- `sortSaveSlotsByDefinition`
- `dedupeSaveSlotsByNewest`
- `getLatestSaveSlot`
- `createLocalStorageSaveSlotStore`

## Config-driven setup

For projects that use `tsuzuru.config.ts`, prefer
`createStandardGameStorageFromConfig`:

```ts
import { createStandardGameStorageFromConfig } from "@tsuzuru/standard-game-storage";
import tsuzuruConfig from "../tsuzuru.config.js";

const gameStorage = createStandardGameStorageFromConfig(tsuzuruConfig);
```

The config shape is declarative:

```ts
storage: {
  enabled: true,
  slots: 3,
  saves: "standard-runtime",
}
```

`createStandardGameStorageFromConfig` reads the `project` and `storage` fields,
then creates preferences, read tracking, and optional save slot stores. It
returns `null` when storage is disabled with `storage: false` or
`storage.enabled: false`. Config-driven storage requires stable `project.id`
and `project.version` so save/read-tracking data can be checked against the
current game identity.

The config file stays data-only. Do not put `localStorage`, parser functions,
runtime objects, or UI policy into `tsuzuru.config.ts`. Tests, SSR hosts, or
custom environments can inject a storage-like object through the helper
options. Applications with a custom runtime save payload can also pass
`runtimeSave` parser hooks while keeping those functions out of config.

`storage.saves: "standard-runtime"` opts into the standard runtime save adapter.
It does not create Save / Load screens or decide when runtime state should be
saved or restored.

## Explicit setup

The lower-level `createStandardGameStorage` API generates conventional
storage keys from the project id by default, creates preferences and read
tracking stores, generates default save slot definitions, and creates a save
slot store when caller-owned save parsing hooks or a standard runtime save
adapter are provided. Applications can still pass `storagePrefix` when they
need an explicit namespace. Example-specific legacy save migration and runtime
restore policy stay in the application.

Current non-goals:

- changing storage keys or save data versions
- standardizing application-specific save data migration
- depending on `@tsuzuru/preact` for runtime payload validation
- adding Preact hooks or UI components
- adding IndexedDB, cloud save, or file save

The package boundary is tracked in
[`docs/plans/standard-game-storage.md`](../../docs/plans/standard-game-storage.md).
