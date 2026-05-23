import {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  createStandardGameStorage,
  createStandardRuntimeSaveAdapter,
  DEFAULT_STANDARD_GAME_PREFERENCES,
  isRead,
  isReadTrackableEvent,
  markRead,
  parseReadTrackingStorageData as parseStandardReadTrackingStorageData,
  STANDARD_GAME_TEXT_SPEED_OPTIONS,
  serializeReadTrackingState as serializeStandardReadTrackingState,
  type StandardGamePreferences,
  type StandardReadEntryKey,
  type StandardReadTrackableEvent,
  type StandardReadTrackingState,
  type StandardReadTrackingStorageData,
  type StandardRuntimeSaveData,
  type StandardSaveSlot,
  type StandardSaveSlotDefinition,
} from "@tsuzuru/standard-game-storage";
import type { RuntimeEvent } from "@tsuzuru/core";
import { isRuntimeSaveData, type RuntimeSaveData } from "@tsuzuru/preact";
import { projectIdentity } from "../tsuzuru.config.js";

// Creator-facing storage setup for this example.
export { projectIdentity };

const STORAGE_PREFIX = "tsuzuru:example-preact-basic";

export const TEXT_SPEED_OPTIONS = STANDARD_GAME_TEXT_SPEED_OPTIONS;
export type TextSpeedCharactersPerSecond = (typeof TEXT_SPEED_OPTIONS)[number];

export interface ExamplePreferences extends StandardGamePreferences {
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
}

export const DEFAULT_EXAMPLE_PREFERENCES: ExamplePreferences = {
  ...DEFAULT_STANDARD_GAME_PREFERENCES,
  textSpeedCharactersPerSecond: 60,
};

export type RetainedMessageEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;
export type ExampleSaveData = StandardRuntimeSaveData<RuntimeSaveData, RetainedMessageEvent>;
export type ExampleSaveSlot = StandardSaveSlot<ExampleSaveData>;
export type ExampleSaveSlotDefinition = StandardSaveSlotDefinition;
export type ReadTrackableEvent = StandardReadTrackableEvent;
export type ReadEntryKey = StandardReadEntryKey;
export type ReadTrackingStorageData = StandardReadTrackingStorageData;
export type ReadTrackingState = StandardReadTrackingState;

export const runtimeSaveAdapter = createStandardRuntimeSaveAdapter<RuntimeSaveData, RetainedMessageEvent>({
  project: projectIdentity,
  isRuntimeData: isRuntimeSaveData,
});

export const gameStorage = createStandardGameStorage({
  project: projectIdentity,
  storagePrefix: STORAGE_PREFIX,
  slots: 3,
  preferences: {
    defaults: DEFAULT_EXAMPLE_PREFERENCES,
    textSpeedOptions: TEXT_SPEED_OPTIONS,
  },
  saves: runtimeSaveAdapter,
});

export const SAVE_SLOT_DEFINITIONS = gameStorage.slotDefinitions;

export {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  markRead,
};

export const createExampleSaveData = runtimeSaveAdapter.createData;
export const getExampleSaveDataSavedAt = runtimeSaveAdapter.getSavedAt;
export const isExampleSaveData = runtimeSaveAdapter.isData;

export function loadPreferences(): ExamplePreferences {
  return gameStorage.preferences.load() as ExamplePreferences;
}

export function savePreferences(preferences: ExamplePreferences): ExamplePreferences {
  return gameStorage.preferences.save(preferences) as ExamplePreferences;
}

export function normalizePreferences(value: unknown): ExamplePreferences {
  return gameStorage.preferences.normalize(value) as ExamplePreferences;
}

export function loadReadTrackingState(): ReadTrackingState {
  return gameStorage.readTracking.load();
}

export function saveReadTrackingState(state: ReadTrackingState): ReadTrackingState {
  return gameStorage.readTracking.save(state);
}

export function serializeReadTrackingState(state: ReadTrackingState): ReadTrackingStorageData {
  return serializeStandardReadTrackingState(state, { project: projectIdentity });
}

export function parseReadTrackingStorageData(value: unknown): ReadTrackingState | null {
  return parseStandardReadTrackingStorageData(value, { project: projectIdentity });
}

export function loadSaveSlots(): readonly ExampleSaveSlot[] {
  return gameStorage.saves.loadSlots();
}

export function saveToSlot(slotId: string, data: ExampleSaveData): readonly ExampleSaveSlot[] {
  return gameStorage.saves.saveToSlot(slotId, data);
}

export function deleteSaveSlot(slotId: string): readonly ExampleSaveSlot[] {
  return gameStorage.saves.deleteSlot(slotId);
}

export function getLatestSaveSlot(slots: readonly ExampleSaveSlot[]): ExampleSaveSlot | null {
  return gameStorage.saves.getLatestSlot(slots);
}

export function parseExampleSaveData(value: unknown, createdAt?: string): ExampleSaveData | null {
  return runtimeSaveAdapter.parseData(value, {
    project: projectIdentity,
    ...(createdAt === undefined ? {} : { savedAt: createdAt }),
  });
}
