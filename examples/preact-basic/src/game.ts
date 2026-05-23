import type { RuntimeEvent } from "@tsuzuru/core";
import { isRuntimeSaveData, type RuntimeSaveData } from "@tsuzuru/preact";
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
import { assets } from "../assets.js";
import scenario from "../scenario/main.tzr";
import { projectIdentity } from "../tsuzuru.config.js";

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

const runtimeSaveAdapter = createStandardRuntimeSaveAdapter<RuntimeSaveData, RetainedMessageEvent>({
  project: projectIdentity,
  isRuntimeData: isRuntimeSaveData,
});

const storage = createStandardGameStorage({
  project: projectIdentity,
  storagePrefix: STORAGE_PREFIX,
  slots: 3,
  preferences: {
    defaults: DEFAULT_EXAMPLE_PREFERENCES,
    textSpeedOptions: TEXT_SPEED_OPTIONS,
  },
  saves: runtimeSaveAdapter,
});

export const game = {
  project: projectIdentity,
  scenario,
  assets,
  storage,
} as const;

export const SAVE_SLOT_DEFINITIONS = game.storage.slotDefinitions;

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
  return game.storage.preferences.load() as ExamplePreferences;
}

export function savePreferences(preferences: ExamplePreferences): ExamplePreferences {
  return game.storage.preferences.save(preferences) as ExamplePreferences;
}

export function normalizePreferences(value: unknown): ExamplePreferences {
  return game.storage.preferences.normalize(value) as ExamplePreferences;
}

export function loadReadTrackingState(): ReadTrackingState {
  return game.storage.readTracking.load();
}

export function saveReadTrackingState(state: ReadTrackingState): ReadTrackingState {
  return game.storage.readTracking.save(state);
}

export function serializeReadTrackingState(state: ReadTrackingState): ReadTrackingStorageData {
  return serializeStandardReadTrackingState(state, { project: game.project });
}

export function parseReadTrackingStorageData(value: unknown): ReadTrackingState | null {
  return parseStandardReadTrackingStorageData(value, { project: game.project });
}

export function loadSaveSlots(): readonly ExampleSaveSlot[] {
  return game.storage.saves.loadSlots();
}

export function saveToSlot(slotId: string, data: ExampleSaveData): readonly ExampleSaveSlot[] {
  return game.storage.saves.saveToSlot(slotId, data);
}

export function deleteSaveSlot(slotId: string): readonly ExampleSaveSlot[] {
  return game.storage.saves.deleteSlot(slotId);
}

export function getLatestSaveSlot(slots: readonly ExampleSaveSlot[]): ExampleSaveSlot | null {
  return game.storage.saves.getLatestSlot(slots);
}

export function parseExampleSaveData(value: unknown, createdAt?: string): ExampleSaveData | null {
  return runtimeSaveAdapter.parseData(value, {
    project: game.project,
    ...(createdAt === undefined ? {} : { savedAt: createdAt }),
  });
}
