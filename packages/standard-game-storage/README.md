# @tsuzuru/standard-game-storage

Standard game storage helpers for Tsuzuru.

This package currently provides preferences and read tracking storage helpers.
Future work can move additional reusable browser game storage helpers out of
`examples/preact-basic` in small steps.

Available APIs:

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

Planned areas:

- save slot storage

Current non-goals:

- changing storage keys or save data versions
- adding Preact hooks or UI components
- adding IndexedDB, cloud save, or file save

The package boundary is tracked in
[`docs/plans/standard-game-storage.md`](../../docs/plans/standard-game-storage.md).
