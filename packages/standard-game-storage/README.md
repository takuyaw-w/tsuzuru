# @tsuzuru/standard-game-storage

Standard game storage helpers for Tsuzuru.

This package currently provides preferences, read tracking, and save slot
storage helpers. It also provides a standard runtime save adapter for hosts that
want the current `RuntimeSaveSlot` envelope while keeping runtime payload
validation caller-owned.

Available APIs:

- `createStandardGameStorage`
- `createStandardGameStorageFromConfig`
- `StandardGameStoragePreset`
- `CreateStandardGameStorageOptions`
- `StandardGamePreferences`
- `DEFAULT_STANDARD_GAME_PREFERENCES`
- `STANDARD_GAME_TEXT_SPEED_OPTIONS`
- `normalizeStandardGamePreferences`
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

The creator-facing `createStandardGameStorage` API generates conventional
storage keys from the project id by default, creates preferences and read
tracking stores, generates default save slot definitions, and creates a save
slot store when caller-owned save parsing hooks or a standard runtime save
adapter are provided. Applications can still pass `storagePrefix` when they
need an explicit namespace. Example-specific legacy save migration and runtime
restore policy stay in the application.

`createStandardGameStorageFromConfig` reads the declarative `storage` block from
`tsuzuru.config.ts` and delegates to the same low-level storage factories. It
does not put `localStorage`, parser functions, or runtime objects into the
config file.

Current non-goals:

- changing storage keys or save data versions
- standardizing application-specific save data migration
- depending on `@tsuzuru/preact` for runtime payload validation
- adding Preact hooks or UI components
- adding IndexedDB, cloud save, or file save

The package boundary is tracked in
[`docs/plans/standard-game-storage.md`](../../docs/plans/standard-game-storage.md).
