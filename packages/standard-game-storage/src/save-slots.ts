import type { StandardGameStorageLike } from "./preferences.js";

export interface StandardSaveProject {
  readonly id: string;
  readonly version: string;
}

export interface StandardSaveSlotDefinition {
  readonly id: string;
  readonly label: string;
}

export interface StandardSaveSlot<TData = unknown> {
  readonly id: string;
  readonly label: string;
  readonly savedAt: string;
  readonly data: TData;
}

export interface StandardSaveSlotParseContext {
  readonly slotId?: string;
  readonly savedAt?: string;
  readonly now?: string;
  readonly project: StandardSaveProject;
}

export interface StandardSaveSlotStore<TData = unknown> {
  readonly loadSlots: () => readonly StandardSaveSlot<TData>[];
  readonly saveToSlot: (slotId: string, data: TData) => readonly StandardSaveSlot<TData>[];
  readonly deleteSlot: (slotId: string) => readonly StandardSaveSlot<TData>[];
  readonly getLatestSlot: (slots: readonly StandardSaveSlot<TData>[]) => StandardSaveSlot<TData> | null;
}

export interface CreateLocalStorageSaveSlotStoreOptions<TData> {
  readonly storageKey: string;
  readonly project: StandardSaveProject;
  readonly slots: readonly StandardSaveSlotDefinition[];
  readonly parseData: (value: unknown, context: StandardSaveSlotParseContext) => TData | null;
  readonly getSavedAt: (data: TData) => string;
  readonly storage?: StandardGameStorageLike | null;
  readonly now?: () => string;
}

export function createLocalStorageSaveSlotStore<TData>(
  options: CreateLocalStorageSaveSlotStoreOptions<TData>,
): StandardSaveSlotStore<TData> {
  const loadSlots = (): readonly StandardSaveSlot<TData>[] => {
    const storage = resolveStorage(options.storage);
    if (storage === null) {
      return [];
    }

    let rawValue: string | null;
    try {
      rawValue = storage.getItem(options.storageKey);
    } catch {
      return [];
    }

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

    const slots: StandardSaveSlot<TData>[] = [];
    for (const item of parsed) {
      const slot = parseSaveSlot(item, options);
      if (slot !== null) {
        slots.push(slot);
      }
    }

    return sortSaveSlotsByDefinition(
      dedupeSaveSlotsByNewest(slots, {
        getSlotId: (slot) => slot.id,
        getSavedAt: (slot) => slot.savedAt,
      }),
      options.slots,
    );
  };

  return {
    loadSlots,
    saveToSlot(slotId, data) {
      const definition = getSaveSlotDefinition(slotId, options.slots);
      if (definition === null) {
        return loadSlots();
      }

      const nextSlot: StandardSaveSlot<TData> = {
        id: definition.id,
        label: definition.label,
        savedAt: options.getSavedAt(data),
        data,
      };
      const nextSlots = sortSaveSlotsByDefinition(
        [...loadSlots().filter((slot) => slot.id !== slotId), nextSlot],
        options.slots,
      );
      writeSaveSlots(nextSlots, options);
      return nextSlots;
    },
    deleteSlot(slotId) {
      const nextSlots = loadSlots().filter((slot) => slot.id !== slotId);
      writeSaveSlots(nextSlots, options);
      return nextSlots;
    },
    getLatestSlot(slots) {
      return getLatestSaveSlot(slots);
    },
  };
}

export function sortSaveSlotsByDefinition<TData>(
  slots: readonly StandardSaveSlot<TData>[],
  definitions: readonly StandardSaveSlotDefinition[],
): readonly StandardSaveSlot<TData>[] {
  return [...slots].sort((left, right) => getSlotIndex(left.id, definitions) - getSlotIndex(right.id, definitions));
}

export function dedupeSaveSlotsByNewest<TData>(
  slots: readonly StandardSaveSlot<TData>[],
  options: {
    readonly getSlotId: (slot: StandardSaveSlot<TData>) => string;
    readonly getSavedAt: (slot: StandardSaveSlot<TData>) => string;
  },
): readonly StandardSaveSlot<TData>[] {
  const latestById = new Map<string, StandardSaveSlot<TData>>();
  for (const slot of slots) {
    const current = latestById.get(options.getSlotId(slot));
    if (current === undefined || options.getSavedAt(slot) > options.getSavedAt(current)) {
      latestById.set(options.getSlotId(slot), slot);
    }
  }
  return [...latestById.values()];
}

export function getLatestSaveSlot<TData>(
  slots: readonly StandardSaveSlot<TData>[],
  options: {
    readonly getSavedAt?: (slot: StandardSaveSlot<TData>) => string;
  } = {},
): StandardSaveSlot<TData> | null {
  const getSavedAt = options.getSavedAt ?? ((slot: StandardSaveSlot<TData>) => slot.savedAt);
  let latestSlot: StandardSaveSlot<TData> | null = null;
  for (const slot of slots) {
    if (latestSlot === null || getSavedAt(slot) > getSavedAt(latestSlot)) {
      latestSlot = slot;
    }
  }
  return latestSlot;
}

function parseSaveSlot<TData>(
  value: unknown,
  options: CreateLocalStorageSaveSlotStoreOptions<TData>,
): StandardSaveSlot<TData> | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const definition = typeof value.id === "string" ? getSaveSlotDefinition(value.id, options.slots) : null;
  const savedAt = typeof value.savedAt === "string" ? value.savedAt : null;
  if (definition === null || savedAt === null) {
    return null;
  }

  const now = options.now?.();
  const context: StandardSaveSlotParseContext = {
    slotId: definition.id,
    savedAt,
    project: options.project,
    ...(now === undefined ? {} : { now }),
  };
  const data = options.parseData(value.data, context);
  if (data === null) {
    return null;
  }

  return {
    id: definition.id,
    label: definition.label,
    savedAt,
    data,
  };
}

function writeSaveSlots<TData>(
  slots: readonly StandardSaveSlot<TData>[],
  options: CreateLocalStorageSaveSlotStoreOptions<TData>,
): void {
  const storage = resolveStorage(options.storage);
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(options.storageKey, JSON.stringify(slots));
  } catch {
    // Storage can be unavailable or full. The caller keeps the returned in-memory slots.
  }
}

function getSaveSlotDefinition(
  slotId: string,
  definitions: readonly StandardSaveSlotDefinition[],
): StandardSaveSlotDefinition | null {
  return definitions.find((definition) => definition.id === slotId) ?? null;
}

function getSlotIndex(slotId: string, definitions: readonly StandardSaveSlotDefinition[]): number {
  return definitions.findIndex((definition) => definition.id === slotId);
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function getDefaultLocalStorage(): StandardGameStorageLike | null {
  try {
    const global = globalThis as {
      readonly localStorage?: StandardGameStorageLike;
      readonly window?: { readonly localStorage?: StandardGameStorageLike };
    };
    return global.localStorage ?? global.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StandardGameStorageLike | null | undefined): StandardGameStorageLike | null {
  return storage === undefined ? getDefaultLocalStorage() : storage;
}
