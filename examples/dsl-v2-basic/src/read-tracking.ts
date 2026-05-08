import type { RuntimeEvent } from "@tsuzuru/core";

export type ReadTrackableEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export type ReadEntryKey = string;

export interface ReadTrackingState {
  readonly readEntryKeys: ReadonlySet<ReadEntryKey>;
}

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
