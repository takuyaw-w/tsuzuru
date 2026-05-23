import type { RuntimeSaveData } from "@tsuzuru/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ExampleSaveData,
  type RetainedMessageEvent,
  createExampleSaveData,
  deleteSaveSlot,
  gameStorage,
  getLatestSaveSlot,
  isExampleSaveData,
  loadSaveSlots,
  parseExampleSaveData,
  SAVE_SLOT_DEFINITIONS,
  saveToSlot,
} from "../src/App.js";
import { projectIdentity } from "../tsuzuru.config.js";

const SAVE_STORAGE_KEY = gameStorage.keys.saves;

const PROJECT_ID = "tsuzuru.example.preact-basic";
const PROJECT_VERSION = "1";

const runtimeSaveData: RuntimeSaveData = {
  version: 2,
  snapshot: {
    version: 2,
    pointer: {
      filePath: "scenario/main.tzr",
      instructionIndex: 1,
    },
    variables: {},
    plugins: {},
    branchFrames: [],
    pendingChoice: null,
    pendingWait: null,
    isStopped: false,
    isWaitingForClick: false,
  },
  event: null,
};

const retainedMessageEvent: RetainedMessageEvent = {
  type: "narration",
  lines: [{ text: "Saved line.", loc: createLoc() }],
};
const savedAt = "2026-01-01T00:00:00.000Z";

describe("save-storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the stable project identity for save compatibility", () => {
    expect(projectIdentity).toEqual({
      id: PROJECT_ID,
      version: PROJECT_VERSION,
    });
  });

  it("keeps the stable save storage key and slot definitions", () => {
    expect(SAVE_STORAGE_KEY).toBe("tsuzuru:example-preact-basic:saves:v1");
    expect(SAVE_SLOT_DEFINITIONS).toEqual([
      { id: "slot-1", label: "Slot 1" },
      { id: "slot-2", label: "Slot 2" },
      { id: "slot-3", label: "Slot 3" },
    ]);
  });

  it("creates v3 save data with a RuntimeSaveSlot for the current scenario identity", () => {
    const saveData = createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt);

    expect(saveData).toMatchObject({
      version: 3,
      saveSlot: {
        version: 1,
        scenarioId: projectIdentity.id,
        scenarioVersion: projectIdentity.version,
        createdAt: savedAt,
        snapshot: runtimeSaveData.snapshot,
      },
      runtime: runtimeSaveData,
      retainedMessageEvent,
    });
    expect(isExampleSaveData(saveData)).toBe(true);
  });

  it("parses v3 save data with a valid RuntimeSaveSlot", () => {
    const saveData = createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt);

    expect(parseExampleSaveData(saveData)).toEqual(saveData);
  });

  it("parses v3 save data with the released project identity values", () => {
    expect(
      parseExampleSaveData({
        version: 3,
        saveSlot: {
          version: 1,
          scenarioId: PROJECT_ID,
          scenarioVersion: PROJECT_VERSION,
          createdAt: savedAt,
          snapshot: runtimeSaveData.snapshot,
        },
        runtime: runtimeSaveData,
        retainedMessageEvent,
      }),
    ).toEqual(createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt));
  });

  it("rejects v3 save data with a mismatched RuntimeSaveSlot scenario id", () => {
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(
      parseExampleSaveData({
        ...saveData,
        saveSlot: {
          ...saveData.saveSlot,
          scenarioId: "tsuzuru.example.other",
        },
      }),
    ).toBeNull();
  });

  it("rejects v3 save data with a mismatched RuntimeSaveSlot scenario version", () => {
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(
      parseExampleSaveData({
        ...saveData,
        saveSlot: {
          ...saveData.saveSlot,
          scenarioVersion: "2",
        },
      }),
    ).toBeNull();
  });

  it("rejects v3 save data with an invalid nested RuntimeSnapshot", () => {
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(
      parseExampleSaveData({
        ...saveData,
        saveSlot: {
          ...saveData.saveSlot,
          snapshot: {
            ...saveData.saveSlot.snapshot,
            version: 3,
          },
        },
      }),
    ).toBeNull();
  });

  it("rejects v3 save data when RuntimeSaveSlot and RuntimeSaveData snapshots differ", () => {
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(
      parseExampleSaveData({
        ...saveData,
        saveSlot: {
          ...saveData.saveSlot,
          snapshot: {
            ...saveData.saveSlot.snapshot,
            pointer: {
              ...saveData.saveSlot.snapshot.pointer,
              instructionIndex: 99,
            },
          },
        },
      }),
    ).toBeNull();
  });

  it("preserves retained message events in v3 save data", () => {
    const saveData = createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt);

    expect(parseExampleSaveData(saveData)?.retainedMessageEvent).toEqual(retainedMessageEvent);
  });

  it("rejects malformed retained message events in v3 save data", () => {
    const invalidRetainedMessageEvent = {
      type: "dialogue",
      lines: [{ text: "Missing speaker." }],
    };
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(
      parseExampleSaveData({
        ...saveData,
        retainedMessageEvent: invalidRetainedMessageEvent,
      }),
    ).toBeNull();
  });

  it("ignores broken JSON and invalid payloads", () => {
    stubSaveStorage("not-json");
    expect(loadSaveSlots()).toEqual([]);

    stubSaveStorage(JSON.stringify({ slots: [] }));
    expect(loadSaveSlots()).toEqual([]);

    stubSaveStorage(
      JSON.stringify([
        {
          id: "slot-1",
          label: "Slot 1",
          savedAt: "2026-01-01T00:00:00.000Z",
          data: { version: 2 },
        },
      ]),
    );
    expect(loadSaveSlots()).toEqual([]);
  });

  it("falls back to in-memory save slot results when localStorage is unavailable", () => {
    vi.stubGlobal("window", {});
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(loadSaveSlots()).toEqual([]);
    expect(saveToSlot("slot-1", saveData)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt,
        data: saveData,
      },
    ]);
  });

  it("falls back without throwing when localStorage access fails", () => {
    const localStorage: Pick<Storage, "getItem" | "setItem"> = {
      getItem() {
        throw new Error("localStorage unavailable");
      },
      setItem() {
        throw new Error("localStorage unavailable");
      },
    };
    vi.stubGlobal("window", { localStorage });
    const saveData = createExampleSaveData(runtimeSaveData, null, savedAt);

    expect(loadSaveSlots()).toEqual([]);
    expect(saveToSlot("slot-1", saveData)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt,
        data: saveData,
      },
    ]);
  });

  it("ignores legacy save data payloads when loading stored slots", () => {
    stubSaveStorage(
      JSON.stringify([
        {
          id: "slot-1",
          label: "ignored",
          savedAt: "2026-01-01T00:00:00.000Z",
          data: {
            version: 1,
            runtime: runtimeSaveData,
            retainedMessageEvent,
          },
        },
        {
          id: "slot-2",
          label: "ignored",
          savedAt: "2026-01-02T00:00:00.000Z",
          data: {
            version: 2,
            scenario: projectIdentity,
            runtime: runtimeSaveData,
            retainedMessageEvent,
          },
        },
        {
          id: "slot-3",
          label: "ignored",
          savedAt: "2026-01-03T00:00:00.000Z",
          data: runtimeSaveData,
        },
      ]),
    );

    expect(loadSaveSlots()).toEqual([]);
  });

  it("uses only compatible slots when selecting the latest save slot", () => {
    const olderCompatibleSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-01T00:00:00.000Z");
    const newerMismatchedSaveData: ExampleSaveData = {
      ...createExampleSaveData(runtimeSaveData, null, "2026-01-02T00:00:00.000Z"),
      saveSlot: {
        ...olderCompatibleSaveData.saveSlot,
        scenarioId: "tsuzuru.example.other",
      },
    };
    stubSaveStorage(
      JSON.stringify([
        {
          id: "slot-1",
          label: "Slot 1",
          savedAt: "2026-01-01T00:00:00.000Z",
          data: olderCompatibleSaveData,
        },
        {
          id: "slot-2",
          label: "Slot 2",
          savedAt: "2026-01-02T00:00:00.000Z",
          data: newerMismatchedSaveData,
        },
      ]),
    );

    const slots = loadSaveSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0]?.id).toBe("slot-1");
    expect(getLatestSaveSlot(slots)?.id).toBe("slot-1");
  });

  it("filters malformed and invalid snapshot slots while keeping valid slots loadable", () => {
    const validSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-01T00:00:00.000Z");
    const invalidSnapshotSaveData = {
      ...createExampleSaveData(runtimeSaveData, null, "2026-01-02T00:00:00.000Z"),
      saveSlot: {
        ...validSaveData.saveSlot,
        snapshot: {
          ...validSaveData.saveSlot.snapshot,
          version: 3,
        },
      },
    };
    stubSaveStorage(
      JSON.stringify([
        { id: "slot-1", label: "ignored", savedAt: validSaveData.saveSlot.createdAt, data: validSaveData },
        { id: "slot-2", label: "ignored", savedAt: "2026-01-02T00:00:00.000Z", data: invalidSnapshotSaveData },
        { id: "slot-3", label: "ignored", savedAt: "2026-01-03T00:00:00.000Z", data: { version: 3 } },
        "broken-slot",
      ]),
    );

    const slots = loadSaveSlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]?.id).toBe("slot-1");
    expect(getLatestSaveSlot(slots)?.id).toBe("slot-1");
  });

  it("does not let an invalid newer duplicate replace an older valid slot", () => {
    const validSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-01T00:00:00.000Z");
    const invalidDuplicateSaveData: ExampleSaveData = {
      ...createExampleSaveData(runtimeSaveData, null, "2026-01-02T00:00:00.000Z"),
      saveSlot: {
        ...validSaveData.saveSlot,
        scenarioVersion: "2",
      },
    };
    stubSaveStorage(
      JSON.stringify([
        { id: "slot-1", label: "ignored", savedAt: "2026-01-01T00:00:00.000Z", data: validSaveData },
        { id: "slot-1", label: "ignored", savedAt: "2026-01-02T00:00:00.000Z", data: invalidDuplicateSaveData },
      ]),
    );

    const slots = loadSaveSlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]?.savedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(getLatestSaveSlot(slots)?.id).toBe("slot-1");
  });

  it("keeps the newest compatible duplicate slot", () => {
    const olderSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-01T00:00:00.000Z");
    const newerSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-02T00:00:00.000Z");
    stubSaveStorage(
      JSON.stringify([
        { id: "slot-1", label: "ignored", savedAt: "2026-01-01T00:00:00.000Z", data: olderSaveData },
        { id: "slot-1", label: "ignored", savedAt: "2026-01-02T00:00:00.000Z", data: newerSaveData },
      ]),
    );

    const slots = loadSaveSlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]?.savedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(slots[0]?.data).toEqual(newerSaveData);
  });

  it("keeps save and delete wrapper behavior on the example storage key", () => {
    stubSaveStorage(null);
    const firstSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-01T00:00:00.000Z");
    const secondSaveData = createExampleSaveData(runtimeSaveData, null, "2026-01-02T00:00:00.000Z");

    expect(saveToSlot("slot-2", secondSaveData)).toEqual([
      {
        id: "slot-2",
        label: "Slot 2",
        savedAt: "2026-01-02T00:00:00.000Z",
        data: secondSaveData,
      },
    ]);
    expect(saveToSlot("slot-1", firstSaveData)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: "2026-01-01T00:00:00.000Z",
        data: firstSaveData,
      },
      {
        id: "slot-2",
        label: "Slot 2",
        savedAt: "2026-01-02T00:00:00.000Z",
        data: secondSaveData,
      },
    ]);
    expect(saveToSlot("unknown", firstSaveData)).toHaveLength(2);
    expect(deleteSaveSlot("slot-2")).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: "2026-01-01T00:00:00.000Z",
        data: firstSaveData,
      },
    ]);
  });
});

function stubSaveStorage(value: string | null): void {
  const values = new Map<string, string>();
  if (value !== null) {
    values.set(SAVE_STORAGE_KEY, value);
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

function createLoc() {
  return {
    start: {
      filePath: "scenario/main.tzr",
      line: 1,
      column: 1,
    },
    end: {
      filePath: "scenario/main.tzr",
      line: 1,
      column: 12,
    },
  };
}
