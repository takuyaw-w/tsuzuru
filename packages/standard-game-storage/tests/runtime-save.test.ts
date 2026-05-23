import type { RuntimeSnapshot } from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStandardGameStorage,
  createStandardRuntimeSaveAdapter,
  isStandardRetainedMessageEvent,
  type StandardGameStorageLike,
} from "../src/index.js";

interface TestRuntimeSaveData {
  readonly version: 2;
  readonly snapshot: RuntimeSnapshot;
  readonly event: unknown | null;
}

const project = {
  id: "tsuzuru.example.preact-basic",
  version: "1",
};

const runtime = {
  version: 2,
  snapshot: createSnapshot(1),
  event: null,
} satisfies TestRuntimeSaveData;

const retainedMessageEvent = {
  type: "dialogue",
  speaker: "mio",
  lines: [{ text: "遅いよ。" }],
} as const;

const savedAt = "2026-01-01T00:00:00.000Z";

describe("standard runtime save adapter", () => {
  it("creates and parses standard runtime save data", () => {
    const adapter = createTestAdapter();
    const saveData = adapter.createData(runtime, retainedMessageEvent, savedAt);

    expect(saveData).toEqual({
      version: 3,
      saveSlot: {
        version: 1,
        scenarioId: project.id,
        scenarioVersion: project.version,
        createdAt: savedAt,
        snapshot: runtime.snapshot,
      },
      runtime,
      retainedMessageEvent,
    });
    expect(adapter.parseData(saveData, { project })).toEqual(saveData);
    expect(adapter.isData(saveData)).toBe(true);
    expect(adapter.getSavedAt(saveData)).toBe(savedAt);
  });

  it("accepts null retained message events", () => {
    const adapter = createTestAdapter();
    const saveData = adapter.createData(runtime, null, savedAt);

    expect(adapter.parseData(saveData, { project })?.retainedMessageEvent).toBeNull();
  });

  it("rejects invalid runtime save data", () => {
    const adapter = createTestAdapter();

    expect(
      adapter.parseData({ version: 3, runtime: { version: 1 }, retainedMessageEvent: null }, { project }),
    ).toBeNull();
  });

  it("rejects project mismatches", () => {
    const adapter = createTestAdapter();
    const saveData = adapter.createData(runtime, null, savedAt);

    expect(
      adapter.parseData(
        {
          ...saveData,
          saveSlot: {
            ...saveData.saveSlot,
            scenarioId: "tsuzuru.example.other",
          },
        },
        { project },
      ),
    ).toBeNull();
  });

  it("rejects invalid nested snapshots and snapshot mismatches", () => {
    const adapter = createTestAdapter();
    const saveData = adapter.createData(runtime, null, savedAt);

    expect(
      adapter.parseData(
        {
          ...saveData,
          saveSlot: {
            ...saveData.saveSlot,
            snapshot: {
              ...saveData.saveSlot.snapshot,
              version: 3,
            },
          },
        },
        { project },
      ),
    ).toBeNull();

    expect(
      adapter.parseData(
        {
          ...saveData,
          saveSlot: {
            ...saveData.saveSlot,
            snapshot: createSnapshot(2),
          },
        },
        { project },
      ),
    ).toBeNull();
  });

  it("rejects malformed retained message events", () => {
    const adapter = createTestAdapter();
    const saveData = adapter.createData(runtime, null, savedAt);

    expect(
      adapter.parseData(
        {
          ...saveData,
          retainedMessageEvent: {
            type: "dialogue",
            lines: [{ text: "Missing speaker." }],
          },
        },
        { project },
      ),
    ).toBeNull();
  });

  it("uses caller-owned migration hooks", () => {
    const adapter = createStandardRuntimeSaveAdapter<TestRuntimeSaveData>({
      project,
      isRuntimeData,
      migrateData(value, context) {
        return isRuntimeData(value) ? context.createData(value, null, context.savedAt) : null;
      },
    });

    expect(adapter.parseData(runtime, { project, savedAt })).toEqual(adapter.createData(runtime, null, savedAt));
  });

  it("creates a save slot store through the standard game storage preset", () => {
    const storage = createMemoryStorage();
    const adapter = createTestAdapter();
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:test",
      slots: 3,
      saves: adapter,
      storage,
    });
    const saveData = adapter.createData(runtime, retainedMessageEvent, savedAt);

    expect(preset.keys.saves).toBe("tsuzuru:test:saves:v1");
    expect(preset.slotDefinitions).toEqual([
      { id: "slot-1", label: "Slot 1" },
      { id: "slot-2", label: "Slot 2" },
      { id: "slot-3", label: "Slot 3" },
    ]);
    expect(preset.saves.saveToSlot("slot-1", saveData)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt,
        data: saveData,
      },
    ]);
    expect(JSON.parse(storage.getItem("tsuzuru:test:saves:v1") ?? "null")).toHaveLength(1);
  });
});

function createTestAdapter() {
  return createStandardRuntimeSaveAdapter<TestRuntimeSaveData>({
    project,
    isRuntimeData,
    isRetainedMessageEvent: isStandardRetainedMessageEvent,
  });
}

function isRuntimeData(value: unknown): value is TestRuntimeSaveData {
  return (
    isObjectRecord(value) &&
    value.version === 2 &&
    isObjectRecord(value.snapshot) &&
    value.snapshot.version === 2 &&
    isObjectRecord(value.snapshot.pointer)
  );
}

function createSnapshot(instructionIndex: number): RuntimeSnapshot {
  return {
    version: 2,
    pointer: {
      filePath: "scenario/main.tzr",
      instructionIndex,
    },
    variables: {},
    plugins: {},
    branchFrames: [],
    pendingChoice: null,
    pendingWait: null,
    isStopped: false,
    isWaitingForClick: false,
  };
}

function createMemoryStorage(): StandardGameStorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
