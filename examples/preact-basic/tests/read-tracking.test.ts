import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInitialReadTrackingState,
  createReadEntryKey,
  isRead,
  loadReadTrackingState,
  markRead,
  parseReadTrackingStorageData,
  READ_TRACKING_STORAGE_KEY,
  type ReadTrackableEvent,
  type ReadTrackingState,
  saveReadTrackingState,
  serializeReadTrackingState,
} from "../src/read-tracking.js";
import { scenarioIdentity } from "../src/scenario.js";

const narrationEvent: ReadTrackableEvent = {
  type: "narration",
  lines: [{ text: "The station clock chimed." }],
};

const dialogueEvent: ReadTrackableEvent = {
  type: "dialogue",
  speaker: "mio",
  lines: [{ text: "遅いよ。" }],
};

describe("read-tracking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates stable read entry keys for narration and dialogue", () => {
    expect(createReadEntryKey(narrationEvent)).toBe("narration:The station clock chimed.");
    expect(createReadEntryKey(dialogueEvent)).toBe("dialogue:mio:遅いよ。");
  });

  it("adds read keys when marking messages as read", () => {
    const key = createReadEntryKey(narrationEvent);
    const state = markRead(createInitialReadTrackingState(), key);

    expect(isRead(state, key)).toBe(true);
  });

  it("deduplicates repeated marks for the same key", () => {
    const key = createReadEntryKey(narrationEvent);
    const state = markRead(markRead(createInitialReadTrackingState(), key), key);

    expect([...state.readEntryKeys]).toEqual([key]);
  });

  it("serializes version and scenario identity", () => {
    const key = createReadEntryKey(dialogueEvent);
    const data = serializeReadTrackingState(markRead(createInitialReadTrackingState(), key));

    expect(data).toEqual({
      version: 1,
      scenario: scenarioIdentity,
      readEntryKeys: [key],
    });
  });

  it("restores valid storage payloads", () => {
    const key = createReadEntryKey(narrationEvent);
    const restored = parseReadTrackingStorageData({
      version: 1,
      scenario: scenarioIdentity,
      readEntryKeys: [key],
    });

    expect(restored).not.toBeNull();
    expect(restored === null ? [] : [...restored.readEntryKeys]).toEqual([key]);
  });

  it("rejects storage payloads with a mismatched scenario id", () => {
    expect(
      parseReadTrackingStorageData({
        version: 1,
        scenario: {
          id: "tsuzuru.example.other",
          version: scenarioIdentity.version,
        },
        readEntryKeys: [createReadEntryKey(narrationEvent)],
      }),
    ).toBeNull();
  });

  it("rejects storage payloads with a mismatched scenario version", () => {
    expect(
      parseReadTrackingStorageData({
        version: 1,
        scenario: {
          id: scenarioIdentity.id,
          version: "2",
        },
        readEntryKeys: [createReadEntryKey(narrationEvent)],
      }),
    ).toBeNull();
  });

  it("falls back to empty state for invalid JSON and malformed payloads", () => {
    stubReadTrackingStorage("not-json");
    expect(loadReadTrackingState()).toEqual(createInitialReadTrackingState());

    stubReadTrackingStorage(JSON.stringify({ version: 1, scenario: scenarioIdentity, readEntryKeys: [123] }));
    expect(loadReadTrackingState()).toEqual(createInitialReadTrackingState());
  });

  it("round trips saved read tracking state through localStorage", () => {
    stubReadTrackingStorage(null);
    const key = createReadEntryKey(dialogueEvent);
    const state: ReadTrackingState = markRead(createInitialReadTrackingState(), key);

    expect(saveReadTrackingState(state)).toBe(state);
    expect([...loadReadTrackingState().readEntryKeys]).toEqual([key]);
  });

  it("deduplicates storage payload keys when restoring", () => {
    const key = createReadEntryKey(narrationEvent);
    const restored = parseReadTrackingStorageData({
      version: 1,
      scenario: scenarioIdentity,
      readEntryKeys: [key, key],
    });

    expect(restored === null ? [] : [...restored.readEntryKeys]).toEqual([key]);
  });
});

function stubReadTrackingStorage(value: string | null): void {
  const values = new Map<string, string>();
  if (value !== null) {
    values.set(READ_TRACKING_STORAGE_KEY, value);
  }

  const localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, nextValue) {
      values.set(key, nextValue);
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  vi.stubGlobal("window", { localStorage });
}
