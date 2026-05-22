import type { RuntimeSaveData } from "@tsuzuru/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createExampleSaveData,
  type ExampleSaveData,
  getLatestSaveSlot,
  isExampleSaveData,
  loadSaveSlots,
  parseExampleSaveData,
  type RetainedMessageEvent,
  SAVE_STORAGE_KEY,
} from "../src/save-storage.js";
import { scenarioIdentity } from "../src/scenario-identity.js";

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
  lines: [{ text: "Saved line." }],
};
const savedAt = "2026-01-01T00:00:00.000Z";

describe("save-storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates v3 save data with a RuntimeSaveSlot for the current scenario identity", () => {
    const saveData = createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt);

    expect(saveData).toMatchObject({
      version: 3,
      saveSlot: {
        version: 1,
        scenarioId: scenarioIdentity.id,
        scenarioVersion: scenarioIdentity.version,
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

  it("migrates v1 example save data to v3 with the current scenario identity", () => {
    const migrated = parseExampleSaveData(
      {
        version: 1,
        runtime: runtimeSaveData,
        retainedMessageEvent,
      },
      savedAt,
    );

    expect(migrated).toEqual(createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt));
  });

  it("migrates legacy raw RuntimeSaveData to v3 with the current scenario identity", () => {
    const migrated = parseExampleSaveData(runtimeSaveData, savedAt);

    expect(migrated).toEqual(createExampleSaveData(runtimeSaveData, null, savedAt));
  });

  it("migrates v2 example save data to v3 with the current scenario identity", () => {
    const migrated = parseExampleSaveData(
      {
        version: 2,
        scenario: scenarioIdentity,
        runtime: runtimeSaveData,
        retainedMessageEvent,
      },
      savedAt,
    );

    expect(migrated).toEqual(createExampleSaveData(runtimeSaveData, retainedMessageEvent, savedAt));
  });

  it("rejects v2 save data with a mismatched scenario id", () => {
    expect(
      parseExampleSaveData({
        version: 2,
        scenario: {
          id: "tsuzuru.example.other",
          version: scenarioIdentity.version,
        },
        runtime: runtimeSaveData,
        retainedMessageEvent: null,
      }),
    ).toBeNull();
  });

  it("rejects v2 save data with a mismatched scenario version", () => {
    expect(
      parseExampleSaveData({
        version: 2,
        scenario: {
          id: scenarioIdentity.id,
          version: "2",
        },
        runtime: runtimeSaveData,
        retainedMessageEvent: null,
      }),
    ).toBeNull();
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

  it("ignores broken JSON and invalid payloads", () => {
    stubSaveStorage("not-json");
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
