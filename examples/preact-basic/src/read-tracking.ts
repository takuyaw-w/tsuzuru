import {
  createInitialReadTrackingState,
  createLocalStorageReadTrackingStore,
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
  serializeReadTrackingState as serializeStandardReadTrackingState,
} from "@tsuzuru/standard-game-storage";
import { projectIdentity } from "../tsuzuru.config.js";

export type ReadTrackableEvent = StandardReadTrackableEvent;

export type ReadEntryKey = StandardReadEntryKey;

export type ReadTrackingStorageData = StandardReadTrackingStorageData;

export type ReadTrackingState = StandardReadTrackingState;

export const READ_TRACKING_STORAGE_KEY = "tsuzuru:example-preact-basic:read-tracking:v1";

const readTrackingStore = createLocalStorageReadTrackingStore({
  storageKey: READ_TRACKING_STORAGE_KEY,
  project: projectIdentity,
});

export {
  createInitialReadTrackingState,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  markRead,
};

export function loadReadTrackingState(): ReadTrackingState {
  return readTrackingStore.load();
}

export function saveReadTrackingState(state: ReadTrackingState): ReadTrackingState {
  return readTrackingStore.save(state);
}

export function serializeReadTrackingState(state: ReadTrackingState): ReadTrackingStorageData {
  return serializeStandardReadTrackingState(state, {
    project: projectIdentity,
  });
}

export function parseReadTrackingStorageData(value: unknown): ReadTrackingState | null {
  return parseStandardReadTrackingStorageData(value, {
    project: projectIdentity,
  });
}
