import {
  createLocalStoragePreferencesStore,
  type StandardGamePreferences,
  type StandardGamePreferencesStore,
  type StandardGameStorageLike,
} from "./preferences.js";
import {
  createLocalStorageReadTrackingStore,
  type StandardReadTrackingProject,
  type StandardReadTrackingStore,
} from "./read-tracking.js";
import {
  createLocalStorageSaveSlotStore,
  type StandardSaveProject,
  type StandardSaveSlotDefinition,
  type StandardSaveSlotParseContext,
  type StandardSaveSlotStore,
} from "./save-slots.js";

export type StandardGameStorageProject = StandardReadTrackingProject & StandardSaveProject;

export interface StandardGameStorageKeys {
  readonly preferences: string;
  readonly readTracking: string;
  readonly saves: string;
}

export interface CreateStandardGameStoragePreferencesOptions {
  readonly defaults?: Partial<StandardGamePreferences>;
  readonly textSpeedOptions?: readonly number[];
  readonly storageKey?: string;
}

export interface CreateStandardGameStorageReadTrackingOptions {
  readonly storageKey?: string;
}

export interface CreateStandardGameStorageSavesOptions<TSaveData> {
  readonly storageKey?: string;
  readonly parseData: (value: unknown, context: StandardSaveSlotParseContext) => TSaveData | null;
  readonly getSavedAt: (data: TSaveData) => string;
  readonly now?: () => string;
}

export interface CreateStandardGameStorageOptions<TSaveData = never> {
  readonly project: StandardGameStorageProject;
  readonly storagePrefix?: string;
  readonly slots?: number | readonly StandardSaveSlotDefinition[];
  readonly preferences?: CreateStandardGameStoragePreferencesOptions;
  readonly readTracking?: CreateStandardGameStorageReadTrackingOptions;
  readonly saves?: CreateStandardGameStorageSavesOptions<TSaveData>;
  readonly storage?: StandardGameStorageLike | null;
}

export interface CreateStandardGameStorageOptionsWithSaves<TSaveData>
  extends Omit<CreateStandardGameStorageOptions<TSaveData>, "saves"> {
  readonly saves: CreateStandardGameStorageSavesOptions<TSaveData>;
}

export interface StandardGameStoragePreset<TSaveData = never> {
  readonly keys: StandardGameStorageKeys;
  readonly slotDefinitions: readonly StandardSaveSlotDefinition[];
  readonly preferences: StandardGamePreferencesStore;
  readonly readTracking: StandardReadTrackingStore;
  readonly saves: StandardSaveSlotStore<TSaveData> | null;
}

export interface StandardGameStoragePresetWithSaves<TSaveData> extends StandardGameStoragePreset<TSaveData> {
  readonly saves: StandardSaveSlotStore<TSaveData>;
}

export function createStandardGameStorage<TSaveData>(
  options: CreateStandardGameStorageOptionsWithSaves<TSaveData>,
): StandardGameStoragePresetWithSaves<TSaveData>;
export function createStandardGameStorage<TSaveData = never>(
  options: CreateStandardGameStorageOptions<TSaveData>,
): StandardGameStoragePreset<TSaveData>;
export function createStandardGameStorage<TSaveData = never>(
  options: CreateStandardGameStorageOptions<TSaveData>,
): StandardGameStoragePreset<TSaveData> {
  validateProject(options.project);
  const keys = createStorageKeys(options);
  const slotDefinitions = resolveSlotDefinitions(options.slots);
  const preferences = createLocalStoragePreferencesStore({
    storageKey: keys.preferences,
    ...(options.preferences?.defaults === undefined ? {} : { defaults: options.preferences.defaults }),
    ...(options.preferences?.textSpeedOptions === undefined
      ? {}
      : { textSpeedOptions: options.preferences.textSpeedOptions }),
    ...(options.storage === undefined ? {} : { storage: options.storage }),
  });
  const readTracking = createLocalStorageReadTrackingStore({
    storageKey: keys.readTracking,
    project: options.project,
    ...(options.storage === undefined ? {} : { storage: options.storage }),
  });

  return {
    keys,
    slotDefinitions,
    preferences,
    readTracking,
    saves:
      options.saves === undefined
        ? null
        : createLocalStorageSaveSlotStore({
            storageKey: keys.saves,
            project: options.project,
            slots: slotDefinitions,
            parseData: options.saves.parseData,
            getSavedAt: options.saves.getSavedAt,
            ...(options.storage === undefined ? {} : { storage: options.storage }),
            ...(options.saves.now === undefined ? {} : { now: options.saves.now }),
          }),
  };
}

function createStorageKeys<TSaveData>(options: CreateStandardGameStorageOptions<TSaveData>): StandardGameStorageKeys {
  const storagePrefix =
    options.storagePrefix === undefined
      ? `tsuzuru:${options.project.id}`
      : validateNonEmptyString(options.storagePrefix, "storagePrefix");
  return {
    preferences:
      options.preferences?.storageKey === undefined
        ? `${storagePrefix}:preferences:v1`
        : validateNonEmptyString(options.preferences.storageKey, "preferences.storageKey"),
    readTracking:
      options.readTracking?.storageKey === undefined
        ? `${storagePrefix}:read-tracking:v1`
        : validateNonEmptyString(options.readTracking.storageKey, "readTracking.storageKey"),
    saves:
      options.saves?.storageKey === undefined
        ? `${storagePrefix}:saves:v1`
        : validateNonEmptyString(options.saves.storageKey, "saves.storageKey"),
  };
}

function resolveSlotDefinitions(
  slots: number | readonly StandardSaveSlotDefinition[] | undefined,
): readonly StandardSaveSlotDefinition[] {
  const definitions =
    slots === undefined
      ? createSlotDefinitions(3)
      : typeof slots === "number"
        ? createSlotDefinitions(slots)
        : [...slots];

  validateSlotDefinitions(definitions);
  return definitions;
}

function createSlotDefinitions(count: number): readonly StandardSaveSlotDefinition[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new TypeError("slots must be a positive integer when it is a number.");
  }

  return Array.from({ length: count }, (_, index) => {
    const slotNumber = index + 1;
    return {
      id: `slot-${slotNumber}`,
      label: `Slot ${slotNumber}`,
    };
  });
}

function validateProject(project: StandardGameStorageProject): void {
  validateNonEmptyString(project.id, "project.id");
  validateNonEmptyString(project.version, "project.version");
}

function validateSlotDefinitions(definitions: readonly StandardSaveSlotDefinition[]): void {
  const seenIds = new Set<string>();
  for (const definition of definitions) {
    const id = validateNonEmptyString(definition.id, "slot id");
    validateNonEmptyString(definition.label, "slot label");
    if (seenIds.has(id)) {
      throw new TypeError(`duplicate save slot id: ${id}`);
    }
    seenIds.add(id);
  }
}

function validateNonEmptyString(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}
