import { describe, expect, it } from "vitest";
import {
  createLocalStorageSaveSlotStore,
  dedupeSaveSlotsByNewest,
  getLatestSaveSlot,
  type StandardGameStorageLike,
  type StandardSaveProject,
  type StandardSaveSlot,
  type StandardSaveSlotDefinition,
  type StandardSaveSlotParseContext,
  sortSaveSlotsByDefinition,
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
} satisfies StandardSaveProject;

const definitions = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
] as const satisfies readonly StandardSaveSlotDefinition[];

describe("standard save slots", () => {
  it("loads an empty slot list for empty, malformed, non-array, or unavailable storage", () => {
    expect(createTestStore(createMemoryStorage()).loadSlots()).toEqual([]);
    expect(createTestStore(createMemoryStorage([["saves", "not-json"]])).loadSlots()).toEqual([]);
    expect(createTestStore(createMemoryStorage([["saves", JSON.stringify({ slots: [] })]])).loadSlots()).toEqual([]);
    expect(createTestStore(null).loadSlots()).toEqual([]);
  });

  it("loads an empty slot list when getItem throws", () => {
    const store = createTestStore({
      getItem() {
        throw new Error("storage unavailable");
      },
      setItem() {
        throw new Error("unused");
      },
    });

    expect(store.loadSlots()).toEqual([]);
  });

  it("does not crash when setItem throws and returns the computed slots", () => {
    const data = createData("2026-01-01T00:00:00.000Z", "first");
    const store = createTestStore({
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("quota exceeded");
      },
    });

    expect(store.saveToSlot("slot-1", data)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: data.savedAt,
        data,
      },
    ]);
  });

  it("round trips valid slots through localStorage-like storage", () => {
    const storage = createMemoryStorage();
    const store = createTestStore(storage);
    const data = createData("2026-01-01T00:00:00.000Z", "first");

    expect(store.saveToSlot("slot-1", data)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: data.savedAt,
        data,
      },
    ]);
    expect(store.loadSlots()).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: data.savedAt,
        data,
      },
    ]);
  });

  it("filters invalid entries, unknown slot ids, incompatible projects, and null parser results", () => {
    const validData = createData("2026-01-01T00:00:00.000Z", "valid");
    const storage = createMemoryStorage([
      [
        "saves",
        JSON.stringify([
          { id: "slot-1", label: "ignored", savedAt: validData.savedAt, data: validData },
          { id: "slot-2", label: "ignored", savedAt: "2026-01-02T00:00:00.000Z", data: { version: 2 } },
          {
            id: "slot-3",
            label: "ignored",
            savedAt: "2026-01-03T00:00:00.000Z",
            data: createData("2026-01-03T00:00:00.000Z", "wrong project", {
              id: "tsuzuru.example.other",
              version: project.version,
            }),
          },
          { id: "slot-4", label: "ignored", savedAt: "2026-01-04T00:00:00.000Z", data: validData },
          { id: "slot-2", label: "ignored", data: validData },
          "broken-slot",
        ]),
      ],
    ]);

    expect(createTestStore(storage).loadSlots()).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: validData.savedAt,
        data: validData,
      },
    ]);
  });

  it("uses slot definitions for ordering and labels", () => {
    const slot1Data = createData("2026-01-01T00:00:00.000Z", "first");
    const slot3Data = createData("2026-01-03T00:00:00.000Z", "third");
    const storage = createMemoryStorage([
      [
        "saves",
        JSON.stringify([
          { id: "slot-3", label: "Stored Slot 3", savedAt: slot3Data.savedAt, data: slot3Data },
          { id: "slot-1", label: "Stored Slot 1", savedAt: slot1Data.savedAt, data: slot1Data },
        ]),
      ],
    ]);

    expect(createTestStore(storage).loadSlots()).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: slot1Data.savedAt,
        data: slot1Data,
      },
      {
        id: "slot-3",
        label: "Slot 3",
        savedAt: slot3Data.savedAt,
        data: slot3Data,
      },
    ]);
  });

  it("keeps the newest compatible duplicate slot", () => {
    const olderData = createData("2026-01-01T00:00:00.000Z", "older");
    const newerData = createData("2026-01-02T00:00:00.000Z", "newer");
    const storage = createMemoryStorage([
      [
        "saves",
        JSON.stringify([
          { id: "slot-1", label: "ignored", savedAt: olderData.savedAt, data: olderData },
          { id: "slot-1", label: "ignored", savedAt: newerData.savedAt, data: newerData },
        ]),
      ],
    ]);

    expect(createTestStore(storage).loadSlots()).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: newerData.savedAt,
        data: newerData,
      },
    ]);
  });

  it("selects the latest slot by savedAt", () => {
    const older = createSlot("slot-1", "Slot 1", "2026-01-01T00:00:00.000Z", "older");
    const newer = createSlot("slot-2", "Slot 2", "2026-01-02T00:00:00.000Z", "newer");

    expect(getLatestSaveSlot([older, newer])).toBe(newer);
    expect(getLatestSaveSlot([])).toBeNull();
  });

  it("replaces an existing slot and inserts new compatible slots", () => {
    const storage = createMemoryStorage();
    const store = createTestStore(storage);
    const first = createData("2026-01-01T00:00:00.000Z", "first");
    const replacement = createData("2026-01-02T00:00:00.000Z", "replacement");
    const second = createData("2026-01-03T00:00:00.000Z", "second");

    store.saveToSlot("slot-1", first);
    expect(store.saveToSlot("slot-1", replacement)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: replacement.savedAt,
        data: replacement,
      },
    ]);
    expect(store.saveToSlot("slot-2", second)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: replacement.savedAt,
        data: replacement,
      },
      {
        id: "slot-2",
        label: "Slot 2",
        savedAt: second.savedAt,
        data: second,
      },
    ]);
  });

  it("ignores unknown slot ids when saving", () => {
    const storage = createMemoryStorage();
    const store = createTestStore(storage);
    const data = createData("2026-01-01T00:00:00.000Z", "first");

    store.saveToSlot("slot-1", data);
    expect(store.saveToSlot("unknown", createData("2026-01-02T00:00:00.000Z", "unknown"))).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: data.savedAt,
        data,
      },
    ]);
  });

  it("deletes slots and treats missing slots as a no-op", () => {
    const storage = createMemoryStorage();
    const store = createTestStore(storage);
    const first = createData("2026-01-01T00:00:00.000Z", "first");
    const second = createData("2026-01-02T00:00:00.000Z", "second");

    store.saveToSlot("slot-1", first);
    store.saveToSlot("slot-2", second);
    expect(store.deleteSlot("slot-1")).toEqual([
      {
        id: "slot-2",
        label: "Slot 2",
        savedAt: second.savedAt,
        data: second,
      },
    ]);
    expect(store.deleteSlot("missing")).toEqual([
      {
        id: "slot-2",
        label: "Slot 2",
        savedAt: second.savedAt,
        data: second,
      },
    ]);
  });

  it("supports destructured store methods", () => {
    const storage = createMemoryStorage();
    const { deleteSlot, loadSlots, saveToSlot } = createTestStore(storage);
    const data = createData("2026-01-01T00:00:00.000Z", "first");

    expect(saveToSlot("slot-1", data)).toEqual([
      {
        id: "slot-1",
        label: "Slot 1",
        savedAt: data.savedAt,
        data,
      },
    ]);
    expect(loadSlots()).toHaveLength(1);
    expect(deleteSlot("slot-1")).toEqual([]);
  });

  it("exposes pure ordering, dedupe, and latest helpers", () => {
    const older = createSlot("slot-1", "Slot 1", "2026-01-01T00:00:00.000Z", "older");
    const newer = createSlot("slot-1", "Slot 1", "2026-01-02T00:00:00.000Z", "newer");
    const slot3 = createSlot("slot-3", "Slot 3", "2026-01-03T00:00:00.000Z", "third");

    expect(
      dedupeSaveSlotsByNewest([older, newer, slot3], {
        getSlotId: (slot) => slot.id,
        getSavedAt: (slot) => slot.savedAt,
      }),
    ).toEqual([newer, slot3]);
    expect(sortSaveSlotsByDefinition([slot3, newer], definitions)).toEqual([newer, slot3]);
    expect(getLatestSaveSlot([newer, slot3], { getSavedAt: (slot) => slot.data.savedAt })).toBe(slot3);
  });

  it("passes savedAt, slotId, project, and now to parseData", () => {
    const contexts: StandardSaveSlotParseContext[] = [];
    const data = createData("2026-01-01T00:00:00.000Z", "first");
    const store = createLocalStorageSaveSlotStore<TestSaveData>({
      storageKey: "saves",
      project,
      slots: definitions,
      parseData(value, context) {
        contexts.push(context);
        return parseData(value, context);
      },
      getSavedAt: (value) => value.savedAt,
      storage: createMemoryStorage([
        ["saves", JSON.stringify([{ id: "slot-1", label: "ignored", savedAt: data.savedAt, data }])],
      ]),
      now: () => "2026-01-04T00:00:00.000Z",
    });

    expect(store.loadSlots()).toHaveLength(1);
    expect(contexts).toEqual([
      {
        slotId: "slot-1",
        savedAt: data.savedAt,
        now: "2026-01-04T00:00:00.000Z",
        project,
      },
    ]);
  });
});

function createTestStore(storage: StandardGameStorageLike | null) {
  return createLocalStorageSaveSlotStore<TestSaveData>({
    storageKey: "saves",
    project,
    slots: definitions,
    parseData,
    getSavedAt: (data) => data.savedAt,
    storage,
  });
}

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

function createSlot(id: string, label: string, savedAt: string, value: string): StandardSaveSlot<TestSaveData> {
  return {
    id,
    label,
    savedAt,
    data: createData(savedAt, value),
  };
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

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
