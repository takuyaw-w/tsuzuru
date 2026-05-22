import type { StandardGameStorageLike } from "./preferences.js";

export type StandardReadEntryKey = string;

export interface StandardReadTrackingState {
  readonly readEntryKeys: ReadonlySet<StandardReadEntryKey>;
}

export interface StandardReadTrackingProject {
  readonly id: string;
  readonly version: string;
}

export interface StandardReadTrackingStorageData {
  readonly version: 1;
  readonly scenario: StandardReadTrackingProject;
  readonly readEntryKeys: readonly StandardReadEntryKey[];
}

export interface StandardReadTrackingTextLine {
  readonly text: string;
}

export interface StandardNarrationReadTrackableEvent {
  readonly type: "narration";
  readonly lines: readonly StandardReadTrackingTextLine[];
}

export interface StandardDialogueReadTrackableEvent {
  readonly type: "dialogue";
  readonly speaker: string;
  readonly lines: readonly StandardReadTrackingTextLine[];
}

export type StandardReadTrackableEvent = StandardNarrationReadTrackableEvent | StandardDialogueReadTrackableEvent;

export interface CreateReadEntryKeyFromTextInput {
  readonly kind: "narration" | "dialogue";
  readonly speaker?: string;
  readonly text: string;
}

export interface StandardReadTrackingStore {
  readonly createInitialState: () => StandardReadTrackingState;
  readonly load: () => StandardReadTrackingState;
  readonly save: (state: StandardReadTrackingState) => StandardReadTrackingState;
  readonly markRead: (state: StandardReadTrackingState, key: StandardReadEntryKey) => StandardReadTrackingState;
  readonly isRead: (state: StandardReadTrackingState, key: StandardReadEntryKey) => boolean;
}

export interface CreateLocalStorageReadTrackingStoreOptions {
  readonly storageKey: string;
  readonly project: StandardReadTrackingProject;
  readonly storage?: StandardGameStorageLike | null;
}

export function isReadTrackableEvent(event: unknown | null | undefined): event is StandardReadTrackableEvent {
  if (!isObjectRecord(event) || !Array.isArray(event.lines) || !event.lines.every(isTextLine)) {
    return false;
  }

  if (event.type === "narration") {
    return true;
  }

  return event.type === "dialogue" && typeof event.speaker === "string";
}

export function createReadEntryKey(event: StandardReadTrackableEvent): StandardReadEntryKey {
  const text = event.lines.map((line) => line.text).join("\n");
  return createReadEntryKeyFromText(
    event.type === "dialogue"
      ? {
          kind: "dialogue",
          speaker: event.speaker,
          text,
        }
      : {
          kind: "narration",
          text,
        },
  );
}

export function createReadEntryKeyFromText(input: CreateReadEntryKeyFromTextInput): StandardReadEntryKey {
  if (input.kind === "dialogue") {
    return `dialogue:${input.speaker ?? ""}:${input.text}`;
  }
  return `narration:${input.text}`;
}

export function createInitialReadTrackingState(): StandardReadTrackingState {
  return {
    readEntryKeys: new Set<StandardReadEntryKey>(),
  };
}

export function markRead(state: StandardReadTrackingState, key: StandardReadEntryKey): StandardReadTrackingState {
  if (state.readEntryKeys.has(key)) {
    return state;
  }

  return {
    readEntryKeys: new Set([...state.readEntryKeys, key]),
  };
}

export function isRead(state: StandardReadTrackingState, key: StandardReadEntryKey): boolean {
  return state.readEntryKeys.has(key);
}

export function serializeReadTrackingState(
  state: StandardReadTrackingState,
  options: {
    readonly project: StandardReadTrackingProject;
  },
): StandardReadTrackingStorageData {
  return {
    version: 1,
    scenario: options.project,
    readEntryKeys: [...state.readEntryKeys],
  };
}

export function parseReadTrackingStorageData(
  value: unknown,
  options: {
    readonly project: StandardReadTrackingProject;
  },
): StandardReadTrackingState | null {
  if (
    !isObjectRecord(value) ||
    value.version !== 1 ||
    !isCompatibleProjectIdentity(value.scenario, options.project) ||
    !Array.isArray(value.readEntryKeys) ||
    !value.readEntryKeys.every(isReadEntryKey)
  ) {
    return null;
  }

  return {
    readEntryKeys: new Set(value.readEntryKeys),
  };
}

export function createLocalStorageReadTrackingStore(
  options: CreateLocalStorageReadTrackingStoreOptions,
): StandardReadTrackingStore {
  return {
    createInitialState: createInitialReadTrackingState,
    load() {
      const storage = resolveStorage(options.storage);
      if (storage === null) {
        return createInitialReadTrackingState();
      }

      let rawValue: string | null;
      try {
        rawValue = storage.getItem(options.storageKey);
      } catch {
        return createInitialReadTrackingState();
      }

      if (rawValue === null) {
        return createInitialReadTrackingState();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        return createInitialReadTrackingState();
      }

      return parseReadTrackingStorageData(parsed, options) ?? createInitialReadTrackingState();
    },
    save(state) {
      const storage = resolveStorage(options.storage);
      if (storage === null) {
        return state;
      }

      try {
        storage.setItem(options.storageKey, JSON.stringify(serializeReadTrackingState(state, options)));
      } catch {
        return state;
      }

      return state;
    },
    markRead,
    isRead,
  };
}

function isCompatibleProjectIdentity(value: unknown, project: StandardReadTrackingProject): boolean {
  return isObjectRecord(value) && value.id === project.id && value.version === project.version;
}

function isReadEntryKey(value: unknown): value is StandardReadEntryKey {
  return typeof value === "string";
}

function isTextLine(value: unknown): value is StandardReadTrackingTextLine {
  return isObjectRecord(value) && typeof value.text === "string";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function getDefaultLocalStorage(): StandardGameStorageLike | null {
  try {
    const global = globalThis as {
      readonly localStorage?: StandardGameStorageLike;
      readonly window?: { readonly localStorage?: StandardGameStorageLike };
    };
    return global.localStorage ?? global.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StandardGameStorageLike | null | undefined): StandardGameStorageLike | null {
  return storage === undefined ? getDefaultLocalStorage() : storage;
}
