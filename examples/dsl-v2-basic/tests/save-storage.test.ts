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
import { scenarioIdentity } from "../src/scenario.js";

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

describe("save-storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates v2 save data with the current scenario identity", () => {
    const saveData = createExampleSaveData(runtimeSaveData, retainedMessageEvent);

    expect(saveData).toMatchObject({
      version: 2,
      scenario: scenarioIdentity,
      runtime: runtimeSaveData,
      retainedMessageEvent,
    });
    expect(isExampleSaveData(saveData)).toBe(true);
  });

  it("migrates v1 example save data to v2 with the current scenario identity", () => {
    const migrated = parseExampleSaveData({
      version: 1,
      runtime: runtimeSaveData,
      retainedMessageEvent,
    });

    expect(migrated).toEqual(createExampleSaveData(runtimeSaveData, retainedMessageEvent));
  });

  it("migrates legacy raw RuntimeSaveData to v2 with the current scenario identity", () => {
    const migrated = parseExampleSaveData(runtimeSaveData);

    expect(migrated).toEqual(createExampleSaveData(runtimeSaveData, null));
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
    const olderCompatibleSaveData = createExampleSaveData(runtimeSaveData, null);
    const newerMismatchedSaveData: ExampleSaveData = {
      version: 2,
      scenario: {
        id: "tsuzuru.example.other",
        version: scenarioIdentity.version,
      },
      runtime: runtimeSaveData,
      retainedMessageEvent: null,
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
