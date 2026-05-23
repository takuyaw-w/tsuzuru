import {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  markRead,
  parseReadTrackingStorageData as parseStandardReadTrackingStorageData,
  type StandardReadEntryKey,
  type StandardReadTrackableEvent,
  type StandardReadTrackingState,
  type StandardReadTrackingStorageData,
  type StandardSaveSlot,
  type StandardSaveSlotDefinition,
  serializeReadTrackingState as serializeStandardReadTrackingState,
} from "@tsuzuru/standard-game-storage";
import { type ExamplePreferences, gameStorage, projectIdentity } from "./game-storage.js";
import {
  type ExampleSaveData,
  isRetainedMessageEvent,
  type RetainedMessageEvent,
  runtimeSaveAdapter,
} from "./save-compatibility.js";

// App/UI facade for the example. Screens import this file instead of depending
// on storage key, slot-store, or legacy compatibility details directly.
export { DEFAULT_EXAMPLE_PREFERENCES, gameStorage, projectIdentity, TEXT_SPEED_OPTIONS } from "./game-storage.js";
export type { ExamplePreferences, ExampleSaveData, RetainedMessageEvent };
export {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  isRetainedMessageEvent,
  markRead,
};

export type TextSpeedCharactersPerSecond = ExamplePreferences["textSpeedCharactersPerSecond"];
export type ReadTrackableEvent = StandardReadTrackableEvent;
export type ReadEntryKey = StandardReadEntryKey;
export type ReadTrackingStorageData = StandardReadTrackingStorageData;
export type ReadTrackingState = StandardReadTrackingState;
export type ExampleSaveSlot = StandardSaveSlot<ExampleSaveData>;
export type ExampleSaveSlotDefinition = StandardSaveSlotDefinition;
export type ExampleScenarioIdentity = typeof projectIdentity;

export const PREFERENCES_STORAGE_KEY = gameStorage.keys.preferences;
export const READ_TRACKING_STORAGE_KEY = gameStorage.keys.readTracking;
export const SAVE_STORAGE_KEY = gameStorage.keys.saves;
export const SAVE_SLOT_DEFINITIONS = gameStorage.slotDefinitions;

export const preferencesStore = gameStorage.preferences;
export const readTrackingStore = gameStorage.readTracking;
export const saveSlotStore = gameStorage.saves;

export const createExampleSaveData = runtimeSaveAdapter.createData;
export const getExampleSaveDataSavedAt = runtimeSaveAdapter.getSavedAt;
export const isExampleSaveData = runtimeSaveAdapter.isData;

export function loadPreferences(): ExamplePreferences {
  return preferencesStore.load() as ExamplePreferences;
}

export function savePreferences(preferences: ExamplePreferences): ExamplePreferences {
  return preferencesStore.save(preferences) as ExamplePreferences;
}

export function normalizePreferences(value: unknown): ExamplePreferences {
  return preferencesStore.normalize(value) as ExamplePreferences;
}

export function loadReadTrackingState(): ReadTrackingState {
  return readTrackingStore.load();
}

export function saveReadTrackingState(state: ReadTrackingState): ReadTrackingState {
  return readTrackingStore.save(state);
}

export function serializeReadTrackingState(state: ReadTrackingState): ReadTrackingStorageData {
  return serializeStandardReadTrackingState(state, { project: projectIdentity });
}

export function parseReadTrackingStorageData(value: unknown): ReadTrackingState | null {
  return parseStandardReadTrackingStorageData(value, { project: projectIdentity });
}

export function loadSaveSlots(): readonly ExampleSaveSlot[] {
  return saveSlotStore.loadSlots();
}

export function saveToSlot(slotId: string, data: ExampleSaveData): readonly ExampleSaveSlot[] {
  return saveSlotStore.saveToSlot(slotId, data);
}

export function deleteSaveSlot(slotId: string): readonly ExampleSaveSlot[] {
  return saveSlotStore.deleteSlot(slotId);
}

export function getLatestSaveSlot(slots: readonly ExampleSaveSlot[]): ExampleSaveSlot | null {
  return saveSlotStore.getLatestSlot(slots);
}

export function parseExampleSaveData(value: unknown, createdAt?: string): ExampleSaveData | null {
  return runtimeSaveAdapter.parseData(value, {
    project: projectIdentity,
    ...(createdAt === undefined ? {} : { savedAt: createdAt }),
  });
}
