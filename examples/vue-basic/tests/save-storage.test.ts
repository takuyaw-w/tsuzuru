import type { RuntimeSaveData } from "@tsuzuru/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createVueExampleSaveData,
  createVueExampleSaveDataFromRuntimeState,
  getLatestSaveSlot,
  loadSaveSlots,
  parseVueExampleSaveData,
  SAVE_STORAGE_KEY,
  saveToSlot,
} from "../src/save-storage.js";
import { scenarioIdentity } from "../src/scenario.js";

const savedAt = "2026-05-17T00:00:00.000Z";

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

describe("vue-basic save storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses v1 save data with a valid RuntimeSaveSlot", () => {
    const saveData = createVueExampleSaveData(runtimeSaveData, savedAt);

    expect(parseVueExampleSaveData(saveData)).toEqual(saveData);
    expect(saveData.saveSlot).toMatchObject({
      version: 1,
      scenarioId: scenarioIdentity.id,
      scenarioVersion: scenarioIdentity.version,
      createdAt: savedAt,
      snapshot: runtimeSaveData.snapshot,
    });
  });

  it("rejects save data when scenarioId mismatches", () => {
    const saveData = createVueExampleSaveData(runtimeSaveData, savedAt);

    expect(
      parseVueExampleSaveData({
        ...saveData,
        saveSlot: {
          ...saveData.saveSlot,
          scenarioId: "other.scenario",
        },
      }),
    ).toBeNull();
  });

  it("rejects save data when scenarioVersion mismatches", () => {
    const saveData = createVueExampleSaveData(runtimeSaveData, savedAt);

    expect(
      parseVueExampleSaveData({
        ...saveData,
        saveSlot: {
          ...saveData.saveSlot,
          scenarioVersion: "2",
        },
      }),
    ).toBeNull();
  });

  it("rejects save data with an invalid nested RuntimeSnapshot", () => {
    const saveData = createVueExampleSaveData(runtimeSaveData, savedAt);

    expect(
      parseVueExampleSaveData({
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

  it("ignores unknown or broken storage payloads", () => {
    stubSaveStorage("not json");
    expect(loadSaveSlots()).toEqual([]);

    stubSaveStorage(JSON.stringify({ slots: [] }));
    expect(loadSaveSlots()).toEqual([]);

    stubSaveStorage(JSON.stringify([{ id: "slot-1", savedAt, data: { version: 1 } }]));
    expect(loadSaveSlots()).toEqual([]);
  });

  it("selects the latest valid saved slot and filters invalid stored slots", () => {
    const olderSaveData = createVueExampleSaveData(runtimeSaveData, "2026-05-17T00:00:00.000Z");
    const newerSaveData = createVueExampleSaveData(runtimeSaveData, "2026-05-17T01:00:00.000Z");
    const invalidSaveData = {
      ...createVueExampleSaveData(runtimeSaveData, "2026-05-17T02:00:00.000Z"),
      saveSlot: {
        ...createVueExampleSaveData(runtimeSaveData, "2026-05-17T02:00:00.000Z").saveSlot,
        scenarioId: "other.scenario",
      },
    };
    stubSaveStorage(
      JSON.stringify([
        { id: "slot-1", label: "ignored", savedAt: olderSaveData.saveSlot.createdAt, data: olderSaveData },
        { id: "slot-2", label: "ignored", savedAt: newerSaveData.saveSlot.createdAt, data: newerSaveData },
        { id: "slot-3", label: "ignored", savedAt: invalidSaveData.saveSlot.createdAt, data: invalidSaveData },
      ]),
    );

    const slots = loadSaveSlots();

    expect(slots).toHaveLength(2);
    expect(getLatestSaveSlot(slots)?.id).toBe("slot-2");
  });

  it("filters malformed and invalid snapshot slots while keeping valid slots loadable", () => {
    const validSaveData = createVueExampleSaveData(runtimeSaveData, "2026-05-17T00:00:00.000Z");
    const invalidSnapshotSaveData = {
      ...createVueExampleSaveData(runtimeSaveData, "2026-05-17T01:00:00.000Z"),
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
        { id: "slot-2", label: "ignored", savedAt: "2026-05-17T01:00:00.000Z", data: invalidSnapshotSaveData },
        { id: "slot-3", label: "ignored", savedAt: "2026-05-17T02:00:00.000Z", data: { version: 1 } },
        "broken-slot",
      ]),
    );

    const slots = loadSaveSlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]?.id).toBe("slot-1");
    expect(getLatestSaveSlot(slots)?.id).toBe("slot-1");
  });

  it("does not let an invalid newer duplicate replace an older valid slot", () => {
    const validSaveData = createVueExampleSaveData(runtimeSaveData, "2026-05-17T00:00:00.000Z");
    const invalidDuplicateSaveData = {
      ...createVueExampleSaveData(runtimeSaveData, "2026-05-17T01:00:00.000Z"),
      saveSlot: {
        ...validSaveData.saveSlot,
        scenarioVersion: "2",
      },
    };
    stubSaveStorage(
      JSON.stringify([
        { id: "slot-1", label: "ignored", savedAt: "2026-05-17T00:00:00.000Z", data: validSaveData },
        { id: "slot-1", label: "ignored", savedAt: "2026-05-17T01:00:00.000Z", data: invalidDuplicateSaveData },
      ]),
    );

    const slots = loadSaveSlots();

    expect(slots).toHaveLength(1);
    expect(slots[0]?.savedAt).toBe("2026-05-17T00:00:00.000Z");
    expect(getLatestSaveSlot(slots)?.id).toBe("slot-1");
  });

  it("persists a valid slot with the example storage key", () => {
    stubSaveStorage(null);
    const saveData = createVueExampleSaveData(runtimeSaveData, savedAt);

    const slots = saveToSlot("slot-1", saveData);

    expect(slots).toHaveLength(1);
    expect(loadSaveSlots()).toHaveLength(1);
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toContain('"slot-1"');
  });

  it("creates save-ready snapshots by composing std-audio and std-effect prepare helpers", () => {
    const saveData = createVueExampleSaveDataFromRuntimeState(
      {
        pointer: {
          filePath: "scenario/main.tzr",
          instructionIndex: 1,
        },
        variables: {},
        plugins: {
          stdAudio: {
            bgm: { assetId: "bgm_main" },
            seEvents: [{ assetId: "click", sequence: 1 }],
            voiceEvents: [{ assetId: "line_001", sequence: 1 }],
            nextSeSequence: 2,
            nextVoiceSequence: 2,
          },
          stdEffect: {
            events: [
              {
                sequence: 1,
                type: "shake",
                target: "screen",
                intensity: "strong",
                durationMs: 300,
              },
            ],
            nextSequence: 2,
          },
        },
        branchFrames: [],
        pendingChoice: null,
        pendingWait: null,
        isStopped: false,
        isWaitingForClick: false,
      },
      null,
      savedAt,
    );

    expect(saveData.runtime.snapshot.plugins).toMatchObject({
      stdAudio: {
        bgm: { assetId: "bgm_main" },
        seEvents: [],
        voiceEvents: [],
        nextSeSequence: 2,
        nextVoiceSequence: 2,
      },
      stdEffect: {
        events: [],
        nextSequence: 2,
      },
    });
    expect(saveData.saveSlot.snapshot).toEqual(saveData.runtime.snapshot);
  });
});

function stubSaveStorage(initialValue: string | null): void {
  let value = initialValue;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => (key === SAVE_STORAGE_KEY ? value : null)),
      setItem: vi.fn((key: string, nextValue: string) => {
        if (key === SAVE_STORAGE_KEY) {
          value = nextValue;
        }
      }),
    },
  });
}
