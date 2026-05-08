import type { RuntimeEvent } from "@tsuzuru/core";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export interface MessageHistoryEntry {
  readonly id: number;
  readonly kind: "narration" | "dialogue";
  readonly speakerName: string | null;
  readonly text: string;
}

export type MessageHistoryEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export interface UseMessageHistoryOptions {
  readonly event: RuntimeEvent | null;
  readonly eventKey: string;
  readonly enabled?: boolean;
}

export interface MessageHistoryState {
  readonly entries: readonly MessageHistoryEntry[];
  readonly clear: () => void;
}

export function useMessageHistory(options: UseMessageHistoryOptions): MessageHistoryState {
  const enabled = options.enabled ?? true;
  const [entries, setEntries] = useState<readonly MessageHistoryEntry[]>([]);
  const recordedEventKeyRef = useRef<string | null>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    const event = options.event;
    if (!enabled || !isMessageHistoryEvent(event) || recordedEventKeyRef.current === options.eventKey) {
      return;
    }

    const id = nextIdRef.current;
    nextIdRef.current += 1;
    recordedEventKeyRef.current = options.eventKey;
    setEntries((current) => [...current, createMessageHistoryEntry(event, id)]);
  }, [enabled, options.event, options.eventKey]);

  const clear = useCallback(() => {
    recordedEventKeyRef.current = null;
    nextIdRef.current = 1;
    setEntries([]);
  }, []);

  return {
    entries,
    clear,
  };
}

export function isMessageHistoryEvent(event: RuntimeEvent | null): event is MessageHistoryEvent {
  return event?.type === "narration" || event?.type === "dialogue";
}

export function createMessageHistoryEntry(event: MessageHistoryEvent, id: number): MessageHistoryEntry {
  return {
    id,
    kind: event.type,
    speakerName: event.type === "dialogue" ? event.speaker : null,
    text: getMessageHistoryText(event),
  };
}

export function getMessageHistoryText(event: MessageHistoryEvent): string {
  return event.lines.map((line) => line.text).join("\n");
}
