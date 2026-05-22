# @tsuzuru/standard-game-storage

Standard game storage helpers for Tsuzuru.

This package currently provides preferences, read tracking, and save slot
storage helpers. Future work can move additional reusable browser game storage
helpers out of `examples/preact-basic` in small steps.

Available APIs:

- `createStandardGameStorage`
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
- `StandardSaveSlot`
- `StandardSaveSlotDefinition`
- `StandardSaveSlotStore`
- `sortSaveSlotsByDefinition`
- `dedupeSaveSlotsByNewest`
- `getLatestSaveSlot`
- `createLocalStorageSaveSlotStore`

The creator-facing `createStandardGameStorage` API generates conventional
storage keys from a `storagePrefix`, creates preferences and read tracking
stores, generates default save slot definitions, and creates a save slot store
when caller-owned save parsing hooks are provided. Example-specific save data
migration and runtime snapshot policy stay in the application.

Current non-goals:

- changing storage keys or save data versions
- standardizing application-specific save data migration
- adding Preact hooks or UI components
- adding IndexedDB, cloud save, or file save

The package boundary is tracked in
[`docs/plans/standard-game-storage.md`](../../docs/plans/standard-game-storage.md).
