import type { RuntimeEvent } from "@tsuzuru/core";
import { scenarioIdentity } from "./scenario.js";

export type ReadTrackableEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export type ReadEntryKey = string;

export interface ReadTrackingStorageData {
  readonly version: 1;
  readonly scenario: {
    readonly id: string;
    readonly version: string;
  };
  readonly readEntryKeys: readonly ReadEntryKey[];
}

export interface ReadTrackingState {
  readonly readEntryKeys: ReadonlySet<ReadEntryKey>;
}

export const READ_TRACKING_STORAGE_KEY = "tsuzuru:example-preact-basic:read-tracking:v1";

export function createInitialReadTrackingState(): ReadTrackingState {
  return {
    readEntryKeys: new Set<ReadEntryKey>(),
  };
}

export function isReadTrackableEvent(event: RuntimeEvent | null): event is ReadTrackableEvent {
  return event?.type === "narration" || event?.type === "dialogue";
}

export function createReadEntryKey(event: ReadTrackableEvent): ReadEntryKey {
  const text = event.lines.map((line) => line.text).join("\n");
  if (event.type === "dialogue") {
    return `dialogue:${event.speaker}:${text}`;
  }
  return `narration:${text}`;
}

export function markRead(state: ReadTrackingState, key: ReadEntryKey): ReadTrackingState {
  if (state.readEntryKeys.has(key)) {
    return state;
  }

  return {
    readEntryKeys: new Set([...state.readEntryKeys, key]),
  };
}

export function isRead(state: ReadTrackingState, key: ReadEntryKey): boolean {
  return state.readEntryKeys.has(key);
}

export function loadReadTrackingState(): ReadTrackingState {
  const rawValue = readStorageValue();
  if (rawValue === null) {
    return createInitialReadTrackingState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return createInitialReadTrackingState();
  }

  return parseReadTrackingStorageData(parsed) ?? createInitialReadTrackingState();
}

export function saveReadTrackingState(state: ReadTrackingState): ReadTrackingState {
  writeReadTrackingStorageData(serializeReadTrackingState(state));
  return state;
}

export function serializeReadTrackingState(state: ReadTrackingState): ReadTrackingStorageData {
  return {
    version: 1,
    scenario: scenarioIdentity,
    readEntryKeys: [...state.readEntryKeys],
  };
}

export function parseReadTrackingStorageData(value: unknown): ReadTrackingState | null {
  if (
    !isObjectRecord(value) ||
    value.version !== 1 ||
    !isCompatibleScenarioIdentity(value.scenario) ||
    !Array.isArray(value.readEntryKeys) ||
    !value.readEntryKeys.every(isReadEntryKey)
  ) {
    return null;
  }

  return {
    readEntryKeys: new Set(value.readEntryKeys),
  };
}

function readStorageValue(): string | null {
  try {
    return getLocalStorage()?.getItem(READ_TRACKING_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeReadTrackingStorageData(data: ReadTrackingStorageData): void {
  try {
    getLocalStorage()?.setItem(READ_TRACKING_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable or full. Read tracking remains in memory.
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function isCompatibleScenarioIdentity(value: unknown): boolean {
  return isObjectRecord(value) && value.id === scenarioIdentity.id && value.version === scenarioIdentity.version;
}

function isReadEntryKey(value: unknown): value is ReadEntryKey {
  return typeof value === "string";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
