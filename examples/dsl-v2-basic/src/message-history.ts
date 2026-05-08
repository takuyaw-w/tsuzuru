import type { RuntimeEvent } from "@tsuzuru/core";

export interface MessageHistoryEntry {
  readonly id: number;
  readonly kind: "narration" | "dialogue";
  readonly speakerName: string | null;
  readonly text: string;
}

export type MessageHistoryEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export function createMessageHistoryEntry(event: MessageHistoryEvent, id: number): MessageHistoryEntry {
  return {
    id,
    kind: event.type,
    speakerName: event.type === "dialogue" ? event.speaker : null,
    text: getMessageHistoryText(event),
  };
}

export function isMessageHistoryEvent(event: RuntimeEvent | null): event is MessageHistoryEvent {
  return event?.type === "narration" || event?.type === "dialogue";
}

export function getMessageHistoryText(event: MessageHistoryEvent): string {
  return event.lines.map((line) => line.text).join("\n");
}
