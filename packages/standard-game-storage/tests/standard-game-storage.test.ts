import type { RuntimeSnapshot } from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createInitialReadTrackingState,
  createStandardGameStorage,
  createStandardGameStorageFromConfig,
  DEFAULT_STANDARD_GAME_PREFERENCES,
  type StandardGamePreferences,
  type StandardGameStorageFromConfigResult,
  type StandardGameStorageLike,
  type StandardReadTrackingProject,
  type StandardRuntimeGameStoragePreset,
  type StandardRuntimeSavePayload,
  type StandardSaveProject,
  type StandardSaveSlotDefinition,
  type StandardSaveSlotParseContext,
  type StandardSaveSlotStore,
} from "../src/index.js";

interface TestSaveData {
  readonly version: 1;
  readonly project: StandardSaveProject;
  readonly savedAt: string;
  readonly value: string;
}

const project = {
  id: "tsuzuru.example.preact-basic",
  version: "1",
} satisfies StandardReadTrackingProject;

const validPreferences = {
  textRevealEnabled: false,
  textSpeedCharactersPerSecond: 120,
  textSoundEnabled: false,
  textSoundVolume: 0.1,
  bgmVolume: 0.2,
  seVolume: 0.3,
  voiceVolume: 0.4,
} satisfies StandardGamePreferences;

describe("standard game storage preset", () => {
  it("generates default storage keys from the storage prefix", () => {
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:example-preact-basic",
      storage: createMemoryStorage(),
    });

    expect(preset.keys).toEqual({
      preferences: "tsuzuru:example-preact-basic:preferences:v1",
      readTracking: "tsuzuru:example-preact-basic:read-tracking:v1",
      saves: "tsuzuru:example-preact-basic:saves:v1",
    });
  });

  it("uses the project id as the default storage prefix", () => {
    const preset = createStandardGameStorage({
      project,
      storage: createMemoryStorage(),
    });

    expect(preset.keys).toEqual({
      preferences: "tsuzuru:tsuzuru.example.preact-basic:preferences:v1",
      readTracking: "tsuzuru:tsuzuru.example.preact-basic:read-tracking:v1",
      saves: "tsuzuru:tsuzuru.example.preact-basic:saves:v1",
    });
  });

  it("prefers explicit storage key overrides", () => {
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:example-preact-basic",
      preferences: {
        storageKey: "custom:preferences",
      },
      readTracking: {
        storageKey: "custom:read",
      },
      saves: {
        storageKey: "custom:saves",
        parseData,
        getSavedAt: (data) => data.savedAt,
      },
      storage: createMemoryStorage(),
    });

    expect(preset.keys).toEqual({
      preferences: "custom:preferences",
      readTracking: "custom:read",
      saves: "custom:saves",
    });
  });

  it("creates preferences and read tracking stores", () => {
    const storage = createMemoryStorage();
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:test",
      preferences: {
        defaults: {
          textSpeedCharactersPerSecond: 30,
        },
        textSpeedOptions: [30, 60],
      },
      storage,
    });

    expect(preset.preferences.load()).toEqual({
      ...DEFAULT_STANDARD_GAME_PREFERENCES,
      textSpeedCharactersPerSecond: 30,
    });
    expect(
      preset.preferences.save({
        ...validPreferences,
        textSpeedCharactersPerSecond: 120,
      }),
    ).toEqual({
      ...validPreferences,
      textSpeedCharactersPerSecond: 30,
    });

    const readState = preset.readTracking.markRead(createInitialReadTrackingState(), "narration:first");
    expect(preset.readTracking.save(readState)).toBe(readState);
    expect([...preset.readTracking.load().readEntryKeys]).toEqual(["narration:first"]);
  });

  it("passes one storage adapter to preferences, read tracking, and saves", () => {
    const storage = createMemoryStorage();
    const preset = createStandardGameStorage<TestSaveData>({
      project,
      storagePrefix: "tsuzuru:test",
      saves: {
        parseData,
        getSavedAt: (data) => data.savedAt,
      },
      storage,
    });
    const data = createData("2026-01-01T00:00:00.000Z", "first");
    const saves = requireSaves(preset.saves);

    preset.preferences.save(validPreferences);
    preset.readTracking.save(preset.readTracking.markRead(createInitialReadTrackingState(), "narration:first"));
    saves.saveToSlot("slot-1", data);

    expect(storage.getItem("tsuzuru:test:preferences:v1")).not.toBeNull();
    expect(storage.getItem("tsuzuru:test:read-tracking:v1")).not.toBeNull();
    expect(storage.getItem("tsuzuru:test:saves:v1")).not.toBeNull();
  });

  it("generates default slot definitions from a count", () => {
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:test",
      slots: 3,
      storage: createMemoryStorage(),
    });

    expect(preset.slotDefinitions).toEqual([
      { id: "slot-1", label: "Slot 1" },
      { id: "slot-2", label: "Slot 2" },
      { id: "slot-3", label: "Slot 3" },
    ]);
  });

  it("uses three slot definitions by default", () => {
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:test",
      storage: createMemoryStorage(),
    });

    expect(preset.slotDefinitions).toEqual([
      { id: "slot-1", label: "Slot 1" },
      { id: "slot-2", label: "Slot 2" },
      { id: "slot-3", label: "Slot 3" },
    ]);
  });

  it("respects explicit slot definitions", () => {
    const slots = [
      { id: "quick", label: "Quick Save" },
      { id: "chapter-1", label: "Chapter 1" },
    ] as const satisfies readonly StandardSaveSlotDefinition[];
    const preset = createStandardGameStorage<TestSaveData>({
      project,
      storagePrefix: "tsuzuru:test",
      slots,
      saves: {
        parseData,
        getSavedAt: (data) => data.savedAt,
      },
      storage: createMemoryStorage(),
    });
    const data = createData("2026-01-01T00:00:00.000Z", "first");
    const saves = requireSaves(preset.saves);

    expect(preset.slotDefinitions).toEqual(slots);
    expect(saves.saveToSlot("quick", data)).toEqual([
      {
        id: "quick",
        label: "Quick Save",
        savedAt: data.savedAt,
        data,
      },
    ]);
  });

  it("returns no save slot store unless save hooks are provided", () => {
    const preset = createStandardGameStorage({
      project,
      storagePrefix: "tsuzuru:test",
      storage: createMemoryStorage(),
    });

    expect(preset.saves).toBeNull();
  });

  it("creates a save slot store when save hooks are provided", () => {
    const storage = createMemoryStorage();
    const preset = createStandardGameStorage<TestSaveData>({
      project,
      storagePrefix: "tsuzuru:test",
      saves: {
        parseData,
        getSavedAt: (data) => data.savedAt,
        now: () => "2026-01-02T00:00:00.000Z",
      },
      storage,
    });
    const data = createData("2026-01-01T00:00:00.000Z", "first");
    const saves = requireSaves(preset.saves);

    expect(saves.saveToSlot("slot-1", data)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: data.savedAt,
        data,
      },
    ]);
    expect(saves.loadSlots()).toHaveLength(1);
  });

  it("rejects invalid storage prefixes", () => {
    expect(() =>
      createStandardGameStorage({
        project,
        storagePrefix: "",
        storage: createMemoryStorage(),
      }),
    ).toThrow(TypeError);
    expect(() =>
      createStandardGameStorage({
        project,
        storagePrefix: "  ",
        storage: createMemoryStorage(),
      }),
    ).toThrow("storagePrefix must be a non-empty string.");
  });

  it("rejects invalid slot counts", () => {
    for (const slots of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        createStandardGameStorage({
          project,
          storagePrefix: "tsuzuru:test",
          slots,
          storage: createMemoryStorage(),
        }),
      ).toThrow("slots must be a positive integer when it is a number.");
    }
  });

  it("rejects duplicate and malformed slot definitions", () => {
    expect(() =>
      createStandardGameStorage({
        project,
        storagePrefix: "tsuzuru:test",
        slots: [
          { id: "slot-1", label: "Slot 1" },
          { id: "slot-1", label: "Duplicate Slot 1" },
        ],
        storage: createMemoryStorage(),
      }),
    ).toThrow("duplicate save slot id: slot-1");

    expect(() =>
      createStandardGameStorage({
        project,
        storagePrefix: "tsuzuru:test",
        slots: [{ id: "", label: "Slot 1" }],
        storage: createMemoryStorage(),
      }),
    ).toThrow("slot id must be a non-empty string.");

    expect(() =>
      createStandardGameStorage({
        project,
        storagePrefix: "tsuzuru:test",
        slots: [{ id: "slot-1", label: "" }],
        storage: createMemoryStorage(),
      }),
    ).toThrow("slot label must be a non-empty string.");
  });

  it("creates standard storage from declarative config", () => {
    const storage = createMemoryStorage();
    const preset = requireRuntimeStorage(
      createStandardGameStorageFromConfig(
        {
          project,
          storage: {
            enabled: true,
            prefix: "tsuzuru:from-config",
            slots: 2,
            preferences: {
              defaults: {
                textSpeedCharactersPerSecond: 30,
              },
              textSpeedOptions: [30, 60],
            },
            saves: "standard-runtime",
          },
        },
        { storage },
      ),
    );
    const runtime = createRuntimePayload(1);
    const saveData = preset.runtimeSaveAdapter.createData(runtime, null, "2026-01-01T00:00:00.000Z");

    expect(preset.keys).toEqual({
      preferences: "tsuzuru:from-config:preferences:v1",
      readTracking: "tsuzuru:from-config:read-tracking:v1",
      saves: "tsuzuru:from-config:saves:v1",
    });
    expect(preset.slotDefinitions).toEqual([
      { id: "slot-1", label: "Slot 1" },
      { id: "slot-2", label: "Slot 2" },
    ]);
    expect(preset.preferences.load().textSpeedCharactersPerSecond).toBe(30);
    expect(preset.saves.saveToSlot("slot-1", saveData)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: "2026-01-01T00:00:00.000Z",
        data: saveData,
      },
    ]);
  });

  it("uses config defaults and supports storage opt-out", () => {
    const preset = createStandardGameStorageFromConfig({
      project,
      storage: {},
    });

    expect(preset?.keys).toEqual({
      preferences: "tsuzuru:tsuzuru.example.preact-basic:preferences:v1",
      readTracking: "tsuzuru:tsuzuru.example.preact-basic:read-tracking:v1",
      saves: "tsuzuru:tsuzuru.example.preact-basic:saves:v1",
    });
    expect(preset?.slotDefinitions).toEqual([
      { id: "slot-1", label: "Slot 1" },
      { id: "slot-2", label: "Slot 2" },
      { id: "slot-3", label: "Slot 3" },
    ]);
    expect(preset?.saves).toBeNull();

    expect(createStandardGameStorageFromConfig({ project, storage: false })).toBeNull();
    expect(createStandardGameStorageFromConfig({ project, storage: { enabled: false } })).toBeNull();
  });

  it("accepts explicit key overrides from config", () => {
    const preset = requireRuntimeStorage(
      createStandardGameStorageFromConfig(
        {
          project,
          storage: {
            preferences: { key: "custom:preferences" },
            readTracking: { key: "custom:read" },
            saves: { kind: "standard-runtime", key: "custom:saves" },
          },
        },
        { storage: createMemoryStorage() },
      ),
    );

    expect(preset.keys).toEqual({
      preferences: "custom:preferences",
      readTracking: "custom:read",
      saves: "custom:saves",
    });
  });

  it("rejects invalid config-driven storage options", () => {
    expect(() =>
      createStandardGameStorageFromConfig({
        storage: {},
      }),
    ).toThrow("project must be provided");
    expect(() =>
      createStandardGameStorageFromConfig({
        project,
        storage: { prefix: "" },
      }),
    ).toThrow("storage.prefix must be a non-empty string");
    expect(() =>
      createStandardGameStorageFromConfig(
        {
          project,
          storage: { saves: "standard-runtime" },
        },
        { runtimeSave: { isRuntimeData } },
      ),
    ).not.toThrow();
    expect(() =>
      createStandardGameStorageFromConfig(
        {
          project,
          storage: {},
        },
        { runtimeSave: { isRuntimeData } },
      ),
    ).toThrow("options.runtimeSave requires storage.saves");
    expect(() =>
      createStandardGameStorageFromConfig({
        project,
        storage: { kind: "custom" as "standard" },
      }),
    ).toThrow('storage.kind must be "standard"');
    expect(() =>
      createStandardGameStorageFromConfig({
        project,
        storage: { saves: "legacy" as "standard-runtime" },
      }),
    ).toThrow('storage.saves must be false, "standard-runtime"');
    expect(() =>
      createStandardGameStorageFromConfig({
        project,
        storage: { preferences: { key: "" } },
      }),
    ).toThrow("preferences.storageKey must be a non-empty string");
    expect(() =>
      createStandardGameStorageFromConfig({
        project,
        storage: { readTracking: { key: "" } },
      }),
    ).toThrow("readTracking.storageKey must be a non-empty string");
    expect(() =>
      createStandardGameStorageFromConfig({
        project,
        storage: { saves: { kind: "standard-runtime", key: "" } },
      }),
    ).toThrow("saves.storageKey must be a non-empty string");
  });
});

function parseData(value: unknown, context: StandardSaveSlotParseContext): TestSaveData | null {
  if (
    !isObjectRecord(value) ||
    value.version !== 1 ||
    typeof value.savedAt !== "string" ||
    typeof value.value !== "string"
  ) {
    return null;
  }
  if (
    !isObjectRecord(value.project) ||
    value.project.id !== context.project.id ||
    value.project.version !== context.project.version
  ) {
    return null;
  }
  return {
    version: 1,
    project: {
      id: value.project.id,
      version: value.project.version,
    },
    savedAt: value.savedAt,
    value: value.value,
  };
}

function requireSaves<TSaveData>(saves: StandardSaveSlotStore<TSaveData> | null): StandardSaveSlotStore<TSaveData> {
  if (saves === null) {
    throw new Error("Expected save slot store.");
  }
  return saves;
}

function requireRuntimeStorage(
  preset: StandardGameStorageFromConfigResult,
): StandardRuntimeGameStoragePreset<StandardRuntimeSavePayload> {
  if (preset === null || !("runtimeSaveAdapter" in preset)) {
    throw new Error("Expected runtime save storage preset.");
  }
  return preset;
}

function createData(savedAt: string, value: string, dataProject: StandardSaveProject = project): TestSaveData {
  return {
    version: 1,
    project: dataProject,
    savedAt,
    value,
  };
}

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

function isRuntimeData(value: unknown): value is StandardRuntimeSavePayload {
  return (
    isObjectRecord(value) &&
    value.version === 2 &&
    isObjectRecord(value.snapshot) &&
    value.snapshot.version === 2 &&
    isObjectRecord(value.snapshot.pointer)
  );
}

function createRuntimePayload(instructionIndex: number): StandardRuntimeSavePayload {
  return {
    version: 2,
    snapshot: createSnapshot(instructionIndex),
    event: null,
  };
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

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
