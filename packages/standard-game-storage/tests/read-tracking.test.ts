import { describe, expect, it } from "vitest";
import {
  createInitialReadTrackingState,
  createLocalStorageReadTrackingStore,
  createReadEntryKey,
  createReadEntryKeyFromText,
  isRead,
  isReadTrackableEvent,
  markRead,
  parseReadTrackingStorageData,
  type StandardGameStorageLike,
  type StandardReadTrackableEvent,
  type StandardReadTrackingProject,
  type StandardReadTrackingState,
  serializeReadTrackingState,
} from "../src/index.js";

const project = {
  id: "tsuzuru.example.preact-basic",
  version: "1",
} satisfies StandardReadTrackingProject;

const narrationEvent = {
  type: "narration",
  lines: [{ text: "The station clock chimed." }],
} satisfies StandardReadTrackableEvent;

const dialogueEvent = {
  type: "dialogue",
  speaker: "mio",
  lines: [{ text: "遅いよ。" }],
} satisfies StandardReadTrackableEvent;

describe("standard read tracking", () => {
  it("creates an empty initial state", () => {
    expect(createInitialReadTrackingState()).toEqual({
      readEntryKeys: new Set(),
    });
  });

  it("creates stable read entry keys for narration and dialogue events", () => {
    expect(createReadEntryKey(narrationEvent)).toBe("narration:The station clock chimed.");
    expect(createReadEntryKey(dialogueEvent)).toBe("dialogue:mio:遅いよ。");
  });

  it("joins multiline event text with newline characters", () => {
    expect(
      createReadEntryKey({
        type: "narration",
        lines: [{ text: "first" }, { text: "second" }],
      }),
    ).toBe("narration:first\nsecond");
    expect(
      createReadEntryKey({
        type: "dialogue",
        speaker: "mio",
        lines: [{ text: "first" }, { text: "second" }],
      }),
    ).toBe("dialogue:mio:first\nsecond");
  });

  it("creates read entry keys from text for backlog and non-runtime callers", () => {
    expect(
      createReadEntryKeyFromText({
        kind: "narration",
        text: "The station clock chimed.",
      }),
    ).toBe("narration:The station clock chimed.");
    expect(
      createReadEntryKeyFromText({
        kind: "dialogue",
        speaker: "mio",
        text: "遅いよ。",
      }),
    ).toBe("dialogue:mio:遅いよ。");
    expect(
      createReadEntryKeyFromText({
        kind: "dialogue",
        text: "No speaker name.",
      }),
    ).toBe("dialogue::No speaker name.");
  });

  it("treats only narration and dialogue events as read trackable", () => {
    expect(isReadTrackableEvent(narrationEvent)).toBe(true);
    expect(isReadTrackableEvent(dialogueEvent)).toBe(true);
    expect(isReadTrackableEvent({ type: "choice", lines: [{ text: "pick" }] })).toBe(false);
    expect(isReadTrackableEvent({ type: "dialogue", lines: [{ text: "missing speaker" }] })).toBe(false);
    expect(isReadTrackableEvent(null)).toBe(false);
    expect(isReadTrackableEvent(undefined)).toBe(false);
  });

  it("adds read keys and reports read state", () => {
    const key = createReadEntryKey(narrationEvent);
    const state = markRead(createInitialReadTrackingState(), key);

    expect(isRead(state, key)).toBe(true);
    expect(isRead(state, "narration:unread")).toBe(false);
  });

  it("deduplicates repeated marks for the same key", () => {
    const key = createReadEntryKey(narrationEvent);
    const once = markRead(createInitialReadTrackingState(), key);
    const twice = markRead(once, key);

    expect(twice).toBe(once);
    expect([...twice.readEntryKeys]).toEqual([key]);
  });

  it("updates state immutably when marking a new key", () => {
    const firstKey = createReadEntryKey(narrationEvent);
    const secondKey = createReadEntryKey(dialogueEvent);
    const initialState = createInitialReadTrackingState();
    const firstState = markRead(initialState, firstKey);
    const secondState = markRead(firstState, secondKey);

    expect(firstState).not.toBe(initialState);
    expect(secondState).not.toBe(firstState);
    expect([...initialState.readEntryKeys]).toEqual([]);
    expect([...firstState.readEntryKeys]).toEqual([firstKey]);
    expect([...secondState.readEntryKeys]).toEqual([firstKey, secondKey]);
  });

  it("serializes version, project identity, and read keys in insertion order", () => {
    const firstKey = createReadEntryKey(narrationEvent);
    const secondKey = createReadEntryKey(dialogueEvent);
    const state = markRead(markRead(createInitialReadTrackingState(), firstKey), secondKey);

    expect(serializeReadTrackingState(state, { project })).toEqual({
      version: 1,
      scenario: project,
      readEntryKeys: [firstKey, secondKey],
    });
  });

  it("parses matching storage payloads and deduplicates stored keys", () => {
    const key = createReadEntryKey(narrationEvent);
    const restored = parseReadTrackingStorageData(
      {
        version: 1,
        scenario: project,
        readEntryKeys: [key, key],
      },
      { project },
    );

    expect(restored).not.toBeNull();
    expect(restored === null ? [] : [...restored.readEntryKeys]).toEqual([key]);
  });

  it("rejects mismatched project identity and malformed payloads", () => {
    const key = createReadEntryKey(narrationEvent);

    expect(
      parseReadTrackingStorageData(
        {
          version: 1,
          scenario: { id: "tsuzuru.example.other", version: project.version },
          readEntryKeys: [key],
        },
        { project },
      ),
    ).toBeNull();
    expect(
      parseReadTrackingStorageData(
        {
          version: 1,
          scenario: { id: project.id, version: "2" },
          readEntryKeys: [key],
        },
        { project },
      ),
    ).toBeNull();
    expect(
      parseReadTrackingStorageData({ version: 2, scenario: project, readEntryKeys: [key] }, { project }),
    ).toBeNull();
    expect(
      parseReadTrackingStorageData({ version: 1, scenario: project, readEntryKeys: [123] }, { project }),
    ).toBeNull();
    expect(parseReadTrackingStorageData(null, { project })).toBeNull();
  });

  it("loads an empty state for malformed JSON and malformed storage payloads", () => {
    const malformedJsonStore = createLocalStorageReadTrackingStore({
      storageKey: "read-tracking",
      project,
      storage: createMemoryStorage([["read-tracking", "not-json"]]),
    });
    const malformedPayloadStore = createLocalStorageReadTrackingStore({
      storageKey: "read-tracking",
      project,
      storage: createMemoryStorage([
        ["read-tracking", JSON.stringify({ version: 1, scenario: project, readEntryKeys: [123] })],
      ]),
    });

    expect(malformedJsonStore.load()).toEqual(createInitialReadTrackingState());
    expect(malformedPayloadStore.load()).toEqual(createInitialReadTrackingState());
  });

  it("loads an empty state when storage is unavailable or getItem throws", () => {
    const unavailableStore = createLocalStorageReadTrackingStore({
      storageKey: "read-tracking",
      project,
      storage: null,
    });
    const throwingStore = createLocalStorageReadTrackingStore({
      storageKey: "read-tracking",
      project,
      storage: {
        getItem() {
          throw new Error("storage unavailable");
        },
        setItem() {
          throw new Error("unused");
        },
      },
    });

    expect(unavailableStore.load()).toEqual(createInitialReadTrackingState());
    expect(throwingStore.load()).toEqual(createInitialReadTrackingState());
  });

  it("returns state when setItem throws", () => {
    const state = markRead(createInitialReadTrackingState(), createReadEntryKey(dialogueEvent));
    const store = createLocalStorageReadTrackingStore({
      storageKey: "read-tracking",
      project,
      storage: {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error("quota exceeded");
        },
      },
    });

    expect(store.save(state)).toBe(state);
  });

  it("round trips through localStorage-like storage with the caller-provided key", () => {
    const storage = createMemoryStorage();
    const store = createLocalStorageReadTrackingStore({
      storageKey: "custom-read-tracking",
      project,
      storage,
    });
    const key = createReadEntryKey(dialogueEvent);
    const state: StandardReadTrackingState = markRead(createInitialReadTrackingState(), key);

    expect(store.save(state)).toBe(state);
    expect([...store.load().readEntryKeys]).toEqual([key]);
    expect(storage.getItem("read-tracking")).toBeNull();
    expect(storage.getItem("custom-read-tracking")).toBe(
      JSON.stringify({
        version: 1,
        scenario: project,
        readEntryKeys: [key],
      }),
    );
  });
});

function createMemoryStorage(initialValues: readonly (readonly [string, string])[] = []): StandardGameStorageLike {
  const values = new Map(initialValues);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
