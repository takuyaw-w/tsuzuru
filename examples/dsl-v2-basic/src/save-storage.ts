import type { RuntimeEvent } from "@tsuzuru/core";
import { isRuntimeSaveData, type RuntimeSaveData } from "@tsuzuru/preact";

export type RetainedMessageEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export interface ExampleSaveData {
  readonly version: 1;
  readonly runtime: RuntimeSaveData;
  readonly retainedMessageEvent: RetainedMessageEvent | null;
}

export interface ExampleSaveSlot {
  readonly id: string;
  readonly label: string;
  readonly savedAt: string;
  readonly data: ExampleSaveData;
}

export interface ExampleSaveSlotDefinition {
  readonly id: string;
  readonly label: string;
}

// The storage key stays v1; slot payloads accept both legacy RuntimeSaveData and ExampleSaveData.
export const SAVE_STORAGE_KEY = "tsuzuru:example-dsl-v2-basic:saves:v1";

export const SAVE_SLOT_DEFINITIONS = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
] as const satisfies readonly ExampleSaveSlotDefinition[];

export function loadSaveSlots(): readonly ExampleSaveSlot[] {
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

  const slots: ExampleSaveSlot[] = [];
  for (const item of parsed) {
    const slot = parseSaveSlot(item);
    if (slot !== null) {
      slots.push(slot);
    }
  }

  return sortBySlotOrder(dedupeSlots(slots));
}

export function createExampleSaveData(
  runtime: RuntimeSaveData,
  retainedMessageEvent: RetainedMessageEvent | null,
): ExampleSaveData {
  return {
    version: 1,
    runtime,
    retainedMessageEvent,
  };
}

export function saveToSlot(slotId: string, data: ExampleSaveData): readonly ExampleSaveSlot[] {
  const definition = getSaveSlotDefinition(slotId);
  if (definition === null) {
    return loadSaveSlots();
  }

  const nextSlot: ExampleSaveSlot = {
    id: definition.id,
    label: definition.label,
    savedAt: new Date().toISOString(),
    data,
  };
  const slots = loadSaveSlots().filter((slot) => slot.id !== slotId);
  const nextSlots = sortBySlotOrder([...slots, nextSlot]);
  writeSaveSlots(nextSlots);
  return nextSlots;
}

export function deleteSaveSlot(slotId: string): readonly ExampleSaveSlot[] {
  const nextSlots = loadSaveSlots().filter((slot) => slot.id !== slotId);
  writeSaveSlots(nextSlots);
  return nextSlots;
}

export function getLatestSaveSlot(slots: readonly ExampleSaveSlot[]): ExampleSaveSlot | null {
  let latestSlot: ExampleSaveSlot | null = null;
  for (const slot of slots) {
    if (latestSlot === null || slot.savedAt > latestSlot.savedAt) {
      latestSlot = slot;
    }
  }
  return latestSlot;
}

export function isExampleSaveData(value: unknown): value is ExampleSaveData {
  if (!isObjectRecord(value) || value.version !== 1 || !isRuntimeSaveData(value.runtime)) {
    return false;
  }

  return value.retainedMessageEvent === null || isRetainedMessageEvent(value.retainedMessageEvent);
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

function readStorageValue(): string | null {
  try {
    return window.localStorage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSaveSlots(slots: readonly ExampleSaveSlot[]): void {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Storage can be unavailable or full. The example keeps running without persistence.
  }
}

function parseSaveSlot(value: unknown): ExampleSaveSlot | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const definition = typeof value.id === "string" ? getSaveSlotDefinition(value.id) : null;
  const data = parseExampleSaveData(value.data);
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

function parseExampleSaveData(value: unknown): ExampleSaveData | null {
  if (isExampleSaveData(value)) {
    return value;
  }

  if (isRuntimeSaveData(value)) {
    return createExampleSaveData(value, null);
  }

  return null;
}

function dedupeSlots(slots: readonly ExampleSaveSlot[]): readonly ExampleSaveSlot[] {
  const latestById = new Map<string, ExampleSaveSlot>();
  for (const slot of slots) {
    const current = latestById.get(slot.id);
    if (current === undefined || slot.savedAt > current.savedAt) {
      latestById.set(slot.id, slot);
    }
  }
  return [...latestById.values()];
}

function sortBySlotOrder(slots: readonly ExampleSaveSlot[]): readonly ExampleSaveSlot[] {
  return [...slots].sort((left, right) => getSlotIndex(left.id) - getSlotIndex(right.id));
}

function getSlotIndex(slotId: string): number {
  return SAVE_SLOT_DEFINITIONS.findIndex((definition) => definition.id === slotId);
}

function getSaveSlotDefinition(slotId: string): ExampleSaveSlotDefinition | null {
  return SAVE_SLOT_DEFINITIONS.find((definition) => definition.id === slotId) ?? null;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isTextLineLike(value: unknown): value is { readonly text: string } {
  return isObjectRecord(value) && typeof value.text === "string";
}
