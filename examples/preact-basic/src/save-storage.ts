import type { TsuzuruProjectConfig } from "@tsuzuru/config";
import type { RuntimeEvent, RuntimeSaveSlot, RuntimeSaveSlotContext, RuntimeSnapshot } from "@tsuzuru/core";
import { validateRuntimeSaveSlot } from "@tsuzuru/core";
import { isRuntimeSaveData, type RuntimeSaveData } from "@tsuzuru/preact";
import {
  createLocalStorageSaveSlotStore,
  type StandardSaveSlot,
  type StandardSaveSlotDefinition,
} from "@tsuzuru/standard-game-storage";
import { projectIdentity } from "../tsuzuru.config.js";

export type RetainedMessageEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export type ExampleScenarioIdentity = TsuzuruProjectConfig;

export interface ExampleSaveData {
  readonly version: 3;
  readonly saveSlot: RuntimeSaveSlot;
  readonly runtime: RuntimeSaveData;
  readonly retainedMessageEvent: RetainedMessageEvent | null;
}

export type ExampleSaveSlot = StandardSaveSlot<ExampleSaveData>;

export type ExampleSaveSlotDefinition = StandardSaveSlotDefinition;

// The storage key stays v1; slot payloads accept both legacy RuntimeSaveData and ExampleSaveData.
export const SAVE_STORAGE_KEY = "tsuzuru:example-preact-basic:saves:v1";

export const SAVE_SLOT_DEFINITIONS = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
] as const satisfies readonly ExampleSaveSlotDefinition[];

const runtimeSaveSlotContext = {
  scenarioId: projectIdentity.id,
  scenarioVersion: projectIdentity.version,
} satisfies RuntimeSaveSlotContext;

const saveSlotStore = createLocalStorageSaveSlotStore<ExampleSaveData>({
  storageKey: SAVE_STORAGE_KEY,
  project: projectIdentity,
  slots: SAVE_SLOT_DEFINITIONS,
  parseData: (value, context) => parseExampleSaveData(value, context.savedAt),
  getSavedAt: (data) => data.saveSlot.createdAt,
});

export function loadSaveSlots(): readonly ExampleSaveSlot[] {
  return saveSlotStore.loadSlots();
}

export function createExampleSaveData(
  runtime: RuntimeSaveData,
  retainedMessageEvent: RetainedMessageEvent | null,
  createdAt: string = new Date().toISOString(),
): ExampleSaveData {
  return {
    version: 3,
    saveSlot: {
      version: 1,
      scenarioId: projectIdentity.id,
      scenarioVersion: projectIdentity.version,
      createdAt,
      snapshot: runtime.snapshot,
    },
    runtime,
    retainedMessageEvent,
  };
}

export function saveToSlot(slotId: string, data: ExampleSaveData): readonly ExampleSaveSlot[] {
  return saveSlotStore.saveToSlot(slotId, data);
}

export function deleteSaveSlot(slotId: string): readonly ExampleSaveSlot[] {
  return saveSlotStore.deleteSlot(slotId);
}

export function getLatestSaveSlot(slots: readonly ExampleSaveSlot[]): ExampleSaveSlot | null {
  return saveSlotStore.getLatestSlot(slots);
}

export function isExampleSaveData(value: unknown): value is ExampleSaveData {
  return parseExampleSaveDataV3(value) !== null;
}

export function isRetainedMessageEvent(value: unknown): value is RetainedMessageEvent {
  if (!isObjectRecord(value) || (value.type !== "narration" && value.type !== "dialogue")) {
    return false;
  }

  if (!Array.isArray(value.lines) || !value.lines.every(isTextLineLike)) {
    return false;
  }

  return value.type !== "dialogue" || typeof value.speaker === "string";
}

export function parseExampleSaveData(value: unknown, createdAt?: string): ExampleSaveData | null {
  const saveDataV3 = parseExampleSaveDataV3(value);
  if (saveDataV3 !== null) {
    return saveDataV3;
  }

  return (
    migrateExampleSaveDataV2(value, createdAt) ??
    migrateExampleSaveDataV1(value, createdAt) ??
    migrateLegacyRuntimeSaveData(value, createdAt)
  );
}

function parseExampleSaveDataV3(value: unknown): ExampleSaveData | null {
  if (!isObjectRecord(value) || value.version !== 3 || !isRuntimeSaveData(value.runtime)) {
    return null;
  }

  if (value.retainedMessageEvent !== null && !isRetainedMessageEvent(value.retainedMessageEvent)) {
    return null;
  }

  const saveSlot = validateRuntimeSaveSlot(value.saveSlot, runtimeSaveSlotContext);
  if (!saveSlot.ok) {
    return null;
  }

  if (!areRuntimeSnapshotsEqual(saveSlot.slot.snapshot, value.runtime.snapshot)) {
    return null;
  }

  return {
    version: 3,
    saveSlot: saveSlot.slot,
    runtime: value.runtime,
    retainedMessageEvent: value.retainedMessageEvent,
  };
}

function migrateExampleSaveDataV2(value: unknown, createdAt?: string): ExampleSaveData | null {
  if (!isExampleSaveDataV2(value)) {
    return null;
  }

  if (!isCompatibleScenarioIdentity(value.scenario)) {
    return null;
  }

  return createExampleSaveData(value.runtime, value.retainedMessageEvent, createdAt);
}

function migrateExampleSaveDataV1(value: unknown, createdAt?: string): ExampleSaveData | null {
  if (!isObjectRecord(value) || value.version !== 1 || !isRuntimeSaveData(value.runtime)) {
    return null;
  }

  if (value.retainedMessageEvent !== null && !isRetainedMessageEvent(value.retainedMessageEvent)) {
    return null;
  }

  return createExampleSaveData(value.runtime, value.retainedMessageEvent, createdAt);
}

function migrateLegacyRuntimeSaveData(value: unknown, createdAt?: string): ExampleSaveData | null {
  if (!isRuntimeSaveData(value)) {
    return null;
  }

  return createExampleSaveData(value, null, createdAt);
}

interface ExampleSaveDataV2 {
  readonly version: 2;
  readonly scenario: ExampleScenarioIdentity;
  readonly runtime: RuntimeSaveData;
  readonly retainedMessageEvent: RetainedMessageEvent | null;
}

function isExampleSaveDataV2(value: unknown): value is ExampleSaveDataV2 {
  if (!isObjectRecord(value) || value.version !== 2 || !isScenarioIdentity(value.scenario)) {
    return false;
  }

  if (!isRuntimeSaveData(value.runtime)) {
    return false;
  }

  return value.retainedMessageEvent === null || isRetainedMessageEvent(value.retainedMessageEvent);
}

function isCompatibleScenarioIdentity(value: ExampleScenarioIdentity): boolean {
  return value.id === projectIdentity.id && value.version === projectIdentity.version;
}

function isScenarioIdentity(value: unknown): value is ExampleScenarioIdentity {
  return isObjectRecord(value) && typeof value.id === "string" && typeof value.version === "string";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isTextLineLike(value: unknown): value is { readonly text: string } {
  return isObjectRecord(value) && typeof value.text === "string";
}

function areRuntimeSnapshotsEqual(left: RuntimeSnapshot, right: RuntimeSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
