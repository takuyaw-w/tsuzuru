export type { ReadEntryKey, ReadTrackableEvent, ReadTrackingState, ReadTrackingStorageData } from "./game-storage.js";
export {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  loadReadTrackingState,
  markRead,
  parseReadTrackingStorageData,
  READ_TRACKING_STORAGE_KEY,
  readTrackingStore,
  saveReadTrackingState,
  serializeReadTrackingState,
} from "./game-storage.js";
