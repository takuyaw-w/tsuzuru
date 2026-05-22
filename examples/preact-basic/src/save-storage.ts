export type {
  ExampleSaveData,
  ExampleSaveSlot,
  ExampleSaveSlotDefinition,
  ExampleScenarioIdentity,
  RetainedMessageEvent,
} from "./game-storage.js";
export {
  createExampleSaveData,
  deleteSaveSlot,
  getExampleSaveDataSavedAt,
  getLatestSaveSlot,
  isExampleSaveData,
  isRetainedMessageEvent,
  loadSaveSlots,
  parseExampleSaveData,
  runtimeSaveSlotContext,
  SAVE_SLOT_DEFINITIONS,
  SAVE_STORAGE_KEY,
  saveSlotStore,
  saveToSlot,
} from "./game-storage.js";
