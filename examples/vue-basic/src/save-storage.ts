import {
  createRuntimeSnapshot,
  prepareRuntimeStateForSnapshot,
  type RuntimeEvent,
  type RuntimeSaveSlot,
  type RuntimeSaveSlotContext,
  type RuntimeSnapshot,
  type RuntimeState,
  validateRuntimeSaveSlot,
} from "@tsuzuru/core";
import { prepareStdAudioStateForSnapshot } from "@tsuzuru/plugin-std-audio";
import { prepareStdEffectStateForSnapshot } from "@tsuzuru/plugin-std-effect";
import { createRuntimeSaveData, isRuntimeSaveData, type RuntimeSaveData } from "@tsuzuru/vue";
import { scenarioIdentity } from "./scenario.js";

export interface VueExampleSaveData {
  readonly version: 1;
  readonly saveSlot: RuntimeSaveSlot;
  readonly runtime: RuntimeSaveData;
}

export interface VueExampleSaveSlot {
  readonly id: string;
  readonly label: string;
  readonly savedAt: string;
  readonly data: VueExampleSaveData;
}

export interface VueExampleSaveSlotDefinition {
  readonly id: string;
  readonly label: string;
}

export const SAVE_STORAGE_KEY = "tsuzuru:example-vue-basic:saves:v1";

export const SAVE_SLOT_DEFINITIONS = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
] as const satisfies readonly VueExampleSaveSlotDefinition[];

const runtimeSaveSlotContext = {
  scenarioId: scenarioIdentity.id,
  scenarioVersion: scenarioIdentity.version,
} satisfies RuntimeSaveSlotContext;

export function createVueExampleSaveData(
  runtime: RuntimeSaveData,
  createdAt: string = new Date().toISOString(),
): VueExampleSaveData {
  return {
    version: 1,
    saveSlot: {
      version: 1,
      scenarioId: scenarioIdentity.id,
      scenarioVersion: scenarioIdentity.version,
      createdAt,
      snapshot: runtime.snapshot,
    },
    runtime,
  };
}

export function createVueExampleSaveDataFromRuntimeState(
  state: RuntimeState,
  event: RuntimeEvent | null,
  createdAt?: string,
): VueExampleSaveData {
  const saveReadyState = prepareRuntimeStateForSnapshot(state, [
    prepareStdAudioStateForSnapshot,
    prepareStdEffectStateForSnapshot,
  ]);
  const snapshot = createRuntimeSnapshot(saveReadyState);
  return createVueExampleSaveData(createRuntimeSaveData(snapshot, event), createdAt);
}

export function loadSaveSlots(): readonly VueExampleSaveSlot[] {
  const rawValue = readStorageValue();
  if (rawValue === null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const slots: VueExampleSaveSlot[] = [];
  for (const item of parsed) {
    const slot = parseSaveSlot(item);
    if (slot !== null) {
      slots.push(slot);
    }
  }

  return sortBySlotOrder(dedupeSlots(slots));
}

export function saveToSlot(slotId: string, data: VueExampleSaveData): readonly VueExampleSaveSlot[] {
  const definition = getSaveSlotDefinition(slotId);
  if (definition === null) {
    return loadSaveSlots();
  }

  const nextSlot: VueExampleSaveSlot = {
    id: definition.id,
    label: definition.label,
    savedAt: data.saveSlot.createdAt,
    data,
  };
  const slots = loadSaveSlots().filter((slot) => slot.id !== slotId);
  const nextSlots = sortBySlotOrder([...slots, nextSlot]);
  writeSaveSlots(nextSlots);
  return nextSlots;
}

export function getLatestSaveSlot(slots: readonly VueExampleSaveSlot[]): VueExampleSaveSlot | null {
  let latestSlot: VueExampleSaveSlot | null = null;
  for (const slot of slots) {
    if (latestSlot === null || slot.savedAt > latestSlot.savedAt) {
      latestSlot = slot;
    }
  }
  return latestSlot;
}

export function parseVueExampleSaveData(value: unknown): VueExampleSaveData | null {
  if (!isObjectRecord(value) || value.version !== 1 || !isRuntimeSaveData(value.runtime)) {
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
    version: 1,
    saveSlot: saveSlot.slot,
    runtime: value.runtime,
  };
}

function parseSaveSlot(value: unknown): VueExampleSaveSlot | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const definition = typeof value.id === "string" ? getSaveSlotDefinition(value.id) : null;
  const data = parseVueExampleSaveData(value.data);
  if (definition === null || typeof value.savedAt !== "string" || data === null) {
    return null;
  }

  return {
    id: definition.id,
    label: definition.label,
    savedAt: value.savedAt,
    data,
  };
}

function readStorageValue(): string | null {
  try {
    return window.localStorage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSaveSlots(slots: readonly VueExampleSaveSlot[]): void {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Storage can be unavailable or full. The example keeps running without persistence.
  }
}

function dedupeSlots(slots: readonly VueExampleSaveSlot[]): readonly VueExampleSaveSlot[] {
  const latestById = new Map<string, VueExampleSaveSlot>();
  for (const slot of slots) {
    const current = latestById.get(slot.id);
    if (current === undefined || slot.savedAt > current.savedAt) {
      latestById.set(slot.id, slot);
    }
  }
  return [...latestById.values()];
}

function sortBySlotOrder(slots: readonly VueExampleSaveSlot[]): readonly VueExampleSaveSlot[] {
  return [...slots].sort((left, right) => getSlotIndex(left.id) - getSlotIndex(right.id));
}

function getSlotIndex(slotId: string): number {
  return SAVE_SLOT_DEFINITIONS.findIndex((definition) => definition.id === slotId);
}

function getSaveSlotDefinition(slotId: string): VueExampleSaveSlotDefinition | null {
  return SAVE_SLOT_DEFINITIONS.find((definition) => definition.id === slotId) ?? null;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function areRuntimeSnapshotsEqual(left: RuntimeSnapshot, right: RuntimeSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
