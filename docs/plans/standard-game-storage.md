# Standard Game Storage Plan

## Status

Implemented; historical plan.

`@tsuzuru/standard-game-storage` now exists, and `examples/preact-basic`
centralizes example setup, including storage policy, in `src/game.ts`. The former
preferences, read-tracking, and save-storage facade files were later removed
after they became re-export-only shims.

## Motivation

`examples/preact-basic` previously contained storage and compatibility logic in
separate facade files that was heavier than an example should own long term.
Current example-specific policy now lives in `examples/preact-basic/src/game.ts`.

The desired direction is to keep game-specific policy in the example while
moving reusable persistence, normalization, validation, and migration helpers
into a dedicated package:

```txt
packages/standard-game-storage
package name: @tsuzuru/standard-game-storage
```

The package should make the example smaller without moving narrative semantics
out of `@tsuzuru/core`, UI rendering into storage code, or browser persistence
policy into `@tsuzuru/standard-ui-preact`.

## Current Responsibilities

### Preferences Facade Before Extraction

Current responsibilities:

- Defines `ExamplePreferences`.
- Defines `TEXT_SPEED_OPTIONS` as `[30, 60, 120]`.
- Defines `DEFAULT_EXAMPLE_PREFERENCES`.
- Owns `PREFERENCES_STORAGE_KEY`:
  `tsuzuru:example-preact-basic:preferences:v1`.
- Loads preferences from `globalThis.localStorage`.
- Saves normalized preferences to localStorage.
- Normalizes unknown values field by field.
- Validates booleans for text reveal and text sound.
- Validates text speed against the allowed options.
- Validates volume fields as finite numbers in the `0..1` range.
- Falls back to defaults when localStorage is unavailable, malformed, or throws.

Current call sites:

- `App.tsx` initializes app state with `loadPreferences()`.
- `App.tsx` persists settings through `savePreferences(next)`.
- `App.tsx` passes volumes into audio asset helpers and text sound playback.
- `App.tsx` passes text speed into `useTextReveal`.
- `SettingsScreen.tsx` renders controls, labels, and option copy.
- Playwright specs hard-code the preferences storage key for cleanup.

Package candidates:

- `StandardGamePreferences` shape.
- `DEFAULT_STANDARD_GAME_PREFERENCES`.
- `STANDARD_GAME_TEXT_SPEED_OPTIONS`.
- `normalizeStandardGamePreferences(...)`.
- Unit-volume validation.
- Safe localStorage-backed load/save helpers.
- A preferences store factory such as
  `createLocalStoragePreferencesStore(...)`.

Example-side policy to keep:

- The storage key.
- Any example-specific default overrides.
- Settings screen layout and labels such as `Slow`, `Normal`, and `Fast`.
- Whether `[30, 60, 120]` is the presented option set.
- How preferences affect text reveal, text sound, and audio channels.

Design notes:

- Package defaults are useful, but the store should accept caller-provided
  defaults so examples and games can tune initial values.
- Volume range can be standardized as `0..1` for the initial package because
  current standard audio helpers already consume normalized volume values.
- localStorage must be recoverable: load failures return normalized defaults,
  and save failures return normalized values without crashing.

### Read Tracking Facade Before Extraction

Current responsibilities:

- Defines `ReadTrackableEvent` as runtime `narration` or `dialogue`.
- Defines `ReadEntryKey` as `string`.
- Defines `ReadTrackingState` as a `ReadonlySet` wrapper.
- Owns `READ_TRACKING_STORAGE_KEY`:
  `tsuzuru:example-preact-basic:read-tracking:v1`.
- Stores payloads with `version: 1`, `scenario`, and `readEntryKeys`.
- Uses `projectIdentity` from `tsuzuru.config.ts` for compatibility checks.
- Creates text-based read keys.
- Adds read keys immutably and deduplicates keys.
- Loads and saves read tracking state through localStorage.
- Rejects malformed payloads and mismatched project identity.

Current read key format:

```txt
narration:${text}
dialogue:${speaker}:${text}
```

For multi-line runtime events, `text` is produced by joining line text with
`\n`.

Current call sites:

- `App.tsx` initializes state with `loadReadTrackingState()`.
- `RuntimeApp` marks only visible narration/dialogue events as read.
- Skip Mode checks whether the current message was already read before marking
  it, so first-time messages are not skipped during the same display.
- Backlog entries compute read badges from matching read entry keys.
- `read-tracking.test.ts` asserts key compatibility, serialization,
  compatibility rejection, invalid data fallback, localStorage round trip, and
  dedupe.

Package candidates:

- `isReadTrackableEvent(event)`.
- `createReadEntryKey(event)`.
- `createReadEntryKeyFromText(...)` for backlog or non-runtime-entry callers.
- `createInitialReadTrackingState()`.
- `markRead(...)`.
- `isRead(...)`.
- `serializeReadTrackingState(...)`.
- `parseReadTrackingStorageData(...)`.
- `createLocalStorageReadTrackingStore(...)`.

Example-side policy to keep:

- The storage key.
- `projectIdentity`.
- When a visible event becomes read.
- Skip Mode behavior.
- Backlog display and labels.

Compatibility notes:

- Preserve the existing text-based key format for the first extraction.
- Preserve `version: 1` read-tracking payload semantics.
- Keep both `project.id` and `project.version` checks.
- Do not move read tracking into `RuntimeSaveData`.

Known text-based key limits:

- Identical narration text in multiple locations collides.
- Identical dialogue by the same speaker collides.
- Editing text, speaker id, or line splitting resets read state.
- Source location, route, branch, and scene are not represented.
- A future compiler/runtime message id would be a better long-term identity,
  but that is not part of this package extraction.

### Save Storage Facade Before Extraction

Current responsibilities:

- Defines `ExampleSaveData` version `3`.
- Defines `ExampleSaveSlot` and `ExampleSaveSlotDefinition`.
- Owns `SAVE_STORAGE_KEY`: `tsuzuru:example-preact-basic:saves:v1`.
- Owns the fixed slot definitions:
  `slot-1`, `slot-2`, and `slot-3`.
- Creates `RuntimeSaveSlot` envelopes with current `projectIdentity`.
- Reads and writes a localStorage array of slots.
- Validates `RuntimeSaveSlot` with `validateRuntimeSaveSlot`.
- Checks project identity compatibility.
- Parses current v3 save data.
- Migrates example v2 save data.
- Migrates example v1 save data.
- Migrates legacy raw `RuntimeSaveData`.
- Validates `retainedMessageEvent`.
- Rejects v3 data when `RuntimeSaveSlot.snapshot` and
  `RuntimeSaveData.snapshot` differ.
- Sorts slots by configured slot order.
- Deduplicates duplicate slot ids by keeping the newest compatible slot.
- Ignores broken JSON, malformed entries, incompatible slots, and invalid
  snapshots.

Current call sites:

- `App.tsx` loads slots with `loadSaveSlots()`.
- Title Continue uses `getLatestSaveSlot(...)`.
- Save UI calls `saveToSlot(...)`.
- Load UI restores `slot.data.runtime`.
- Runtime restore also restores `slot.data.retainedMessageEvent`.
- Delete UI calls `deleteSaveSlot(...)`.
- `save-storage.test.ts` covers identity, v1/v2/v3 migration, raw
  `RuntimeSaveData` migration, retained message validation, snapshot
  validation, incompatible slot filtering, sorting, and dedupe.
- Playwright save/load specs assert the storage key, project id/version,
  `ExampleSaveData.version: 3`, `RuntimeSaveSlot.version: 1`, and
  `RuntimeSaveData.version: 2`.

Package candidates:

- Save slot store creation.
- LocalStorage JSON array read/write with recoverable failures.
- Slot definition validation and ordering.
- Slot dedupe.
- Latest-slot selection.
- Save slot list mechanics around caller-validated payloads.
- Optional standard save envelope creation around `RuntimeSaveSlot`.
- Standard save data parsing hooks and compatibility validation.
- Explicit migration hooks for legacy payloads, without a broad migration
  framework.

Example-side policy to keep:

- The storage key.
- Slot ids and labels.
- `projectIdentity`.
- Whether retained message events are captured.
- The UI screens for Save, Load, and Continue.
- When snapshots are prepared before save.
- Whether restore suppresses visual transitions.

Compatibility notes:

- This is the highest-risk extraction and should happen after preferences and
  read tracking.
- Do not change the storage key.
- Do not change `ExampleSaveData.version` during the extraction.
- Do not change `RuntimeSaveData.version` or `RuntimeSaveSlot.version`.
- Do not change `scenarioId` or `scenarioVersion`.
- Do not drop v1/v2/raw `RuntimeSaveData` migration.
- Do not weaken retained-message validation.
- Do not remove the snapshot equality check.

## Package Boundary

`@tsuzuru/standard-game-storage` should be separate from
`@tsuzuru/standard-ui-preact`.

```txt
@tsuzuru/standard-ui-preact:
  UI components, UI hooks, presentation layers

@tsuzuru/standard-game-storage:
  browser game storage, preferences, read tracking, save slots
```

The storage package may depend on stable Tsuzuru runtime/config types when
needed, but it must not own runtime stepping, rendering, UI screens, asset
resolution, or scenario semantics.

Name rationale:

- `@tsuzuru/standard-game-storage` is specific enough to cover visual-novel game
  persistence without claiming to be a generic key/value utility.
- `@tsuzuru/browser-storage` is too browser-specific and would make future
  IndexedDB, native, or cloud adapters look like conceptual exceptions.
- `@tsuzuru/standard-storage` is too broad and would invite unrelated caches,
  asset manifests, analytics data, or arbitrary application state.

Initial backend stance:

- Provide localStorage factories first because that is the current example
  behavior.
- Keep the core store logic shaped around a small storage adapter interface so
  IndexedDB or cloud save can be added later without changing caller policy.
- localStorage must be unavailable-safe and quota-error-safe.
- Async storage can be considered before IndexedDB/cloud work, but the first
  extraction should not force async into the current synchronous example unless
  that migration is explicitly planned.

## Proposed Package

Future package:

```txt
packages/standard-game-storage
package name: @tsuzuru/standard-game-storage
```

Primary responsibilities:

- Normalize standard game preferences.
- Persist preferences through a caller-provided storage key.
- Track read narration/dialogue entries using the current compatible key format.
- Persist read tracking through a caller-provided storage key and project
  identity.
- Manage save slot arrays through caller-provided slot definitions.
- Create and parse standard save envelopes around caller-validated runtime save
  data.
- Validate save compatibility through project identity and core
  `RuntimeSaveSlot` validation.
- Keep legacy migration behavior available through explicit hooks while the
  example still has old data to read.

Non-responsibilities:

- Preact hooks or components.
- Save, Load, Settings, Backlog, Gallery, or Title screens.
- Runtime stepping or restore orchestration.
- Snapshot preparation policy.
- Scenario version policy.
- Storage key selection.
- IndexedDB or cloud implementations in the initial package.

## API Sketch

The preferred API shape is store-object factories. The example should be able to
centralize policy in an example-owned setup module:

```ts
import {
  createLocalStoragePreferencesStore,
  createLocalStorageReadTrackingStore,
  createLocalStorageSaveSlotStore,
} from "@tsuzuru/standard-game-storage";
import { projectIdentity } from "../tsuzuru.config.js";

export const preferencesStore = createLocalStoragePreferencesStore({
  storageKey: "tsuzuru:example-preact-basic:preferences:v1",
});

export const readTrackingStore = createLocalStorageReadTrackingStore({
  project: projectIdentity,
  storageKey: "tsuzuru:example-preact-basic:read-tracking:v1",
});

export const saveSlotStore = createLocalStorageSaveSlotStore({
  project: projectIdentity,
  storageKey: "tsuzuru:example-preact-basic:saves:v1",
  slots: [
    { id: "slot-1", label: "Slot 1" },
    { id: "slot-2", label: "Slot 2" },
    { id: "slot-3", label: "Slot 3" },
  ],
});
```

Store APIs should keep current example usage direct:

```ts
export interface StandardGamePreferences {
  readonly textRevealEnabled: boolean;
  readonly textSpeedCharactersPerSecond: number;
  readonly textSoundEnabled: boolean;
  readonly textSoundVolume: number;
  readonly bgmVolume: number;
  readonly seVolume: number;
  readonly voiceVolume: number;
}

export interface StandardGamePreferencesStore {
  readonly load: () => StandardGamePreferences;
  readonly save: (preferences: StandardGamePreferences) => StandardGamePreferences;
  readonly normalize: (value: unknown) => StandardGamePreferences;
}

export interface StandardReadTrackingStore {
  readonly createInitialState: () => StandardReadTrackingState;
  readonly load: () => StandardReadTrackingState;
  readonly save: (state: StandardReadTrackingState) => StandardReadTrackingState;
  readonly markRead: (
    state: StandardReadTrackingState,
    key: StandardReadEntryKey,
  ) => StandardReadTrackingState;
  readonly isRead: (state: StandardReadTrackingState, key: StandardReadEntryKey) => boolean;
}

export interface StandardSaveSlotStore<TData = unknown> {
  readonly loadSlots: () => readonly StandardSaveSlot<TData>[];
  readonly saveToSlot: (slotId: string, data: TData) => readonly StandardSaveSlot<TData>[];
  readonly deleteSlot: (slotId: string) => readonly StandardSaveSlot<TData>[];
  readonly getLatestSlot: (slots: readonly StandardSaveSlot<TData>[]) => StandardSaveSlot<TData> | null;
}
```

Function exports should also remain available for testing and custom stores:

```ts
export function normalizeStandardGamePreferences(value: unknown, options?: {
  readonly defaults?: Partial<StandardGamePreferences>;
  readonly textSpeedOptions?: readonly number[];
}): StandardGamePreferences;

export function isReadTrackableEvent(event: RuntimeEvent | null): event is StandardReadTrackableEvent;
export function createReadEntryKey(event: StandardReadTrackableEvent): StandardReadEntryKey;
export function createReadEntryKeyFromText(input: {
  readonly kind: "narration" | "dialogue";
  readonly speaker?: string;
  readonly text: string;
}): StandardReadEntryKey;

export function createStandardSaveData<TRuntimeSaveData, TPresentation = unknown>(
  runtime: TRuntimeSaveData,
  presentation: TPresentation,
  options: {
    readonly project: TsuzuruProjectConfig;
    readonly snapshot: RuntimeSnapshot;
    readonly createdAt?: string;
  },
): StandardSaveData<TRuntimeSaveData, TPresentation>;

export function parseStandardSaveData<TRuntimeSaveData, TPresentation = unknown>(
  value: unknown,
  options: {
    readonly project: TsuzuruProjectConfig;
    readonly parseRuntime: (value: unknown) => TRuntimeSaveData | null;
    readonly parsePresentation?: (value: unknown) => TPresentation | null;
    readonly migrations?: readonly StandardSaveDataMigration[];
  },
): StandardSaveData<TRuntimeSaveData, TPresentation> | null;

export function createLocalStorageSaveSlotStore<TData>(options: {
  readonly storageKey: string;
  readonly project: TsuzuruProjectConfig;
  readonly slots: readonly StandardSaveSlotDefinition[];
  readonly parseData: (value: unknown, context: StandardSaveSlotParseContext) => TData | null;
  readonly getSavedAt: (data: TData) => string;
}): StandardSaveSlotStore<TData>;
```

API decisions:

- Prefer store objects for example wiring because they bind `storageKey`,
  `project`, defaults, and slot definitions once.
- Keep pure functions exportable for tests and non-localStorage stores.
- Do not provide Preact hooks in the initial package. Hooks belong in app code
  or a later UI integration layer after storage behavior settles.
- Make `project` required for read tracking and save slots.
- Make `storageKey` required for localStorage stores.
- Accept an injectable storage adapter for tests, SSR, and non-window contexts.
- Treat localStorage absence as empty/default state, not as fatal.
- Keep migration APIs explicit; hidden automatic migrations are too risky for
  save compatibility.
- Keep `RuntimeSaveData` validation injectable so the package does not have to
  depend on `@tsuzuru/preact` in its first package boundary.
- Keep `retainedMessageEvent` as presentation payload policy rather than a
  required part of every save envelope.

## Migration Plan

Step 0: create this plan.

- Add `docs/plans/standard-game-storage.md`.
- No implementation changes.

Step 1: add package skeleton.

- Add `packages/standard-game-storage`.
- Add package metadata, TypeScript config, build/test scripts, and public
  export entrypoint.
- Wire root package inventory, build scripts, release-readiness checks, and
  docs only as needed for a new package.
- Do not change `examples/preact-basic` behavior yet.
- First implementation task:
  `Add @tsuzuru/standard-game-storage package skeleton.`

Step 2: move preferences storage logic.

- Add preference types, defaults, normalization, and localStorage store helpers.
- Keep the example preferences facade as a thin wrapper at first. It was later
  removed once a single example storage entrypoint replaced them.
- Preserve `PREFERENCES_STORAGE_KEY`.
- Preserve current defaults unless the example explicitly overrides package
  defaults.
- Add package unit tests for malformed values, unavailable storage, throwing
  storage, invalid volumes, invalid text speeds, and round trip behavior.
- Next implementation task:
  `Move preferences storage logic into @tsuzuru/standard-game-storage.`

Step 3: move read-tracking storage logic.

- Add read tracking state helpers, key generation, serialization/parsing, and
  localStorage store helpers.
- Keep the text-based key format exactly.
- Keep read-tracking payload `version: 1`.
- Require caller-provided `project`.
- Keep `READ_TRACKING_STORAGE_KEY` in the example.
- Keep marking timing and Skip Mode policy in `App.tsx`.
- Add package tests that mirror the current example tests.

Step 4: move save-storage logic last.

- Add save slot store helpers after preferences and read tracking are stable.
- Preserve `SAVE_STORAGE_KEY`.
- Preserve current save data version while extracting.
- Preserve v1/v2/raw `RuntimeSaveData` migration.
- Preserve retained-message validation.
- Preserve `RuntimeSaveSlot` validation and snapshot equality checks.
- Keep slot definitions and retained-message capture policy example-side.
- Prefer a generic `parseData` hook first so example-specific legacy migrations
  do not become a package-wide compatibility promise.
- Add package tests before changing example imports.

Step 5: reduce `examples/preact-basic` to policy wiring.

- Introduce an example-owned storage setup module.
- Bind storage keys, project identity, defaults, and slot definitions there.
- Remove heavy generic parsing/normalization/migration code from example files
  only after equivalent package tests exist.
- Keep screens and runtime orchestration in the example.

Step 6: consider `create-tsuzuru` and starter propagation separately.

- Do not update generated templates in this plan.
- Decide later whether starter projects need this package or whether it is too
  heavy for the minimal creator-facing template.

## Compatibility Risks

Save compatibility:

- Existing local saves live under
  `tsuzuru:example-preact-basic:saves:v1`; that key must not change during
  extraction.
- Current save data is `ExampleSaveData.version: 3`; extraction alone must not
  bump it.
- Current runtime save payloads are `RuntimeSaveData.version: 2`.
- Current save slot envelopes are `RuntimeSaveSlot.version: 1`.
- `scenarioId` and `scenarioVersion` come from `projectIdentity`; changing
  those values invalidates compatible saves.
- v2 save data requires matching scenario id and version.
- v3 save data requires a valid `RuntimeSaveSlot` for the current project.
- v3 save data requires `saveSlot.snapshot` and `runtime.snapshot` to be equal.
- v1 example save data and legacy raw `RuntimeSaveData` currently migrate; the
  package extraction must keep those paths until an explicit removal plan exists.
- `retainedMessageEvent` keeps narration/dialogue visible during waits and
  choices; validation and restore behavior must be preserved.

Read tracking compatibility:

- Existing read tracking lives under
  `tsuzuru:example-preact-basic:read-tracking:v1`; that key must not change
  during extraction.
- The current payload version is `1`.
- The current key format is text-based and must be preserved:
  `narration:${text}` and `dialogue:${speaker}:${text}`.
- Both project id and project version must match.
- The current key format has known collisions and edit sensitivity, but fixing
  that requires a future runtime/compiler message identity design.

Preferences compatibility:

- Existing preferences live under
  `tsuzuru:example-preact-basic:preferences:v1`; that key must not change during
  extraction.
- Existing values should continue to normalize field by field.
- Invalid fields should fall back to defaults without discarding valid sibling
  fields.
- localStorage failures should not crash the game.

Test coupling:

- Playwright tests currently hard-code storage keys and project identity.
- Unit tests assert exact save/read formats.
- Any later implementation should move tests deliberately with the code they
  validate rather than loosening compatibility assertions prematurely.

## Non-goals

- Create `packages/standard-game-storage` in this task.
- Remove the former example facade files in the initial package extraction
  task.
- Change save data version.
- Change storage keys.
- Change `projectIdentity`.
- Change `RuntimeSaveData` or `RuntimeSaveSlot`.
- Add IndexedDB.
- Add cloud save.
- Add file save.
- Add Preact hooks.
- Add UI screens.
- Add save/load panels to `@tsuzuru/standard-ui-preact`.
- Update `create-tsuzuru` templates.
- Publish, release, or tag packages.
- Design a compiler/runtime message id system.

## Grill-me Results

Objection: a separate package may be unnecessary because the current code has
only one consumer.

Response: keep this as a staged extraction. The package should start only after
the skeleton task is accepted, and each extraction must keep example wrappers
until tests prove no behavior changed.

Objection: `@tsuzuru/standard-ui-preact` would be simpler for preferences.

Response: storage keys, persistence failures, project identity, read state, and
save compatibility are not UI component responsibilities. The UI package may
render controls; the storage package owns reusable storage mechanics.

Objection: preferences are game policy and may become too rigid if
standardized.

Response: standardize only the current common shape and normalization helpers.
Require caller-provided storage keys and allow caller-provided defaults/options.
Do not standardize Settings screen copy or layout.

Objection: text-based read keys are known to be weak.

Response: preserve them only as the compatibility format. Document their limits
and avoid presenting them as the final read identity model.

Objection: save storage is too specific and could freeze save/load semantics.

Response: move save storage last. Keep migration hooks explicit, keep
retained-message policy caller-visible, and do not hide scenario/runtime
compatibility failures.

Objection: adding this to `create-tsuzuru` could make starters too heavy.

Response: template propagation is a separate decision after the package exists.
The first package consumers should be examples, not generated projects.

Objection: localStorage is too browser-specific.

Response: localStorage factories are acceptable as the first adapter because
they match current behavior, but the package boundary should accept storage
adapters and avoid naming the package after browser storage.

Alternative considered: separate `@tsuzuru/read-tracking` or adding
preferences to `@tsuzuru/standard-ui-preact`.

Decision: keep the current plan centered on
`@tsuzuru/standard-game-storage` so the example can hide preferences, read
tracking, and save slots behind one game-storage policy module while preserving
the UI/storage boundary.

## Next Implementation Task

Add @tsuzuru/standard-game-storage package skeleton.

Then:

Move preferences storage logic into @tsuzuru/standard-game-storage.
