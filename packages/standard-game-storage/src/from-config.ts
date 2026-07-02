import type { TsuzuruConfig, TsuzuruStorageConfig, TsuzuruStorageSavesConfig } from "@tsuzuru/config";
import type { RuntimeEvent, RuntimeSnapshot } from "@tsuzuru/core";
import type { StandardGameStorageLike } from "./preferences.js";
import {
  type CreateStandardGameStorageOptions,
  createStandardGameStorage,
  type StandardGameStoragePreset,
  type StandardGameStoragePresetWithSaves,
  type StandardGameStorageProject,
} from "./preset.js";
import {
  type CreateStandardRuntimeSaveAdapterOptions,
  createStandardRuntimeSaveAdapter,
  type StandardRetainedMessageEvent,
  type StandardRuntimeSaveAdapter,
  type StandardRuntimeSaveData,
  type StandardRuntimeSnapshotContainer,
} from "./runtime-save.js";

export interface StandardRuntimeSavePayload extends StandardRuntimeSnapshotContainer {
  readonly version: 2;
  readonly event: RuntimeEvent | null;
}

export interface CreateStandardGameStorageFromConfigOptions<
  TRuntimeData extends StandardRuntimeSnapshotContainer = StandardRuntimeSavePayload,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> {
  readonly storage?: StandardGameStorageLike | null;
  readonly runtimeSave?: Omit<CreateStandardRuntimeSaveAdapterOptions<TRuntimeData, TRetainedMessageEvent>, "project">;
}

export interface StandardRuntimeGameStoragePreset<
  TRuntimeData extends StandardRuntimeSnapshotContainer = StandardRuntimeSavePayload,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> extends StandardGameStoragePresetWithSaves<StandardRuntimeSaveData<TRuntimeData, TRetainedMessageEvent>> {
  readonly runtimeSaveAdapter: StandardRuntimeSaveAdapter<TRuntimeData, TRetainedMessageEvent>;
}

export type StandardGameStorageFromConfigResult<
  TRuntimeData extends StandardRuntimeSnapshotContainer = StandardRuntimeSavePayload,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
> = StandardGameStoragePreset<unknown> | StandardRuntimeGameStoragePreset<TRuntimeData, TRetainedMessageEvent> | null;

export class StandardGameStorageConfigError extends TypeError {
  public override readonly name = "StandardGameStorageConfigError";
}

export function createStandardGameStorageFromConfig<
  TRuntimeData extends StandardRuntimeSnapshotContainer = StandardRuntimeSavePayload,
  TRetainedMessageEvent = StandardRetainedMessageEvent,
>(
  config: Pick<TsuzuruConfig, "project" | "storage">,
  options: CreateStandardGameStorageFromConfigOptions<TRuntimeData, TRetainedMessageEvent> = {},
): StandardGameStorageFromConfigResult<TRuntimeData, TRetainedMessageEvent> {
  const storageConfig = config.storage;
  if (storageConfig === false) {
    return null;
  }
  if (storageConfig?.enabled === false) {
    return null;
  }

  const project = validateProject(config.project);
  const storageOptions = resolveStorageOptions(storageConfig, options);
  const savesConfig = resolveSavesConfig(storageConfig);

  if (savesConfig === null) {
    if (options.runtimeSave !== undefined) {
      throw invalidConfig('options.runtimeSave requires storage.saves to be "standard-runtime".');
    }
    return createStandardGameStorage({
      ...storageOptions,
      project,
    });
  }

  const runtimeSaveAdapter = createStandardRuntimeSaveAdapter<TRuntimeData, TRetainedMessageEvent>({
    project,
    ...createRuntimeSaveOptions(options.runtimeSave),
  });
  const preset = createStandardGameStorage({
    ...storageOptions,
    project,
    saves: {
      ...runtimeSaveAdapter,
      ...(savesConfig.key === undefined ? {} : { storageKey: savesConfig.key }),
    },
  });

  return {
    ...preset,
    runtimeSaveAdapter,
  };
}

export function isStandardRuntimeSavePayload(value: unknown): value is StandardRuntimeSavePayload {
  if (!isObjectRecord(value) || value.version !== 2 || !isRuntimeSnapshotLike(value.snapshot)) {
    return false;
  }

  if (value.event === null) {
    return true;
  }

  return isObjectRecord(value.event) && typeof value.event.type === "string";
}

function resolveStorageOptions(
  config: TsuzuruStorageConfig | false | undefined,
  options: Pick<CreateStandardGameStorageFromConfigOptions, "storage">,
): Omit<CreateStandardGameStorageOptions<never>, "project" | "saves"> {
  if (config === false) {
    throw invalidConfig("storage must be enabled before resolving storage options.");
  }
  if (config !== undefined && config.kind !== undefined && config.kind !== "standard") {
    throw invalidConfig('storage.kind must be "standard" when provided.');
  }

  const preferences = config?.preferences;
  const readTracking = config?.readTracking;
  return {
    ...(config?.prefix === undefined ? {} : { storagePrefix: validateNonEmptyString(config.prefix, "storage.prefix") }),
    ...(config?.slots === undefined ? {} : { slots: config.slots }),
    ...(preferences === undefined
      ? {}
      : {
          preferences: {
            ...(preferences.defaults === undefined ? {} : { defaults: preferences.defaults }),
            ...(preferences.textSpeedOptions === undefined ? {} : { textSpeedOptions: preferences.textSpeedOptions }),
            ...(preferences.key === undefined ? {} : { storageKey: preferences.key }),
          },
        }),
    ...(readTracking === undefined
      ? {}
      : {
          readTracking: readTracking.key === undefined ? {} : { storageKey: readTracking.key },
        }),
    ...(options.storage === undefined ? {} : { storage: options.storage }),
  };
}

function resolveSavesConfig(config: TsuzuruStorageConfig | false | undefined): TsuzuruStorageSavesConfig | null {
  if (config === false || config === undefined || config.saves === undefined || config.saves === false) {
    return null;
  }
  if (config.saves === "standard-runtime") {
    return { kind: "standard-runtime" };
  }
  if (isObjectRecord(config.saves) && config.saves.kind === "standard-runtime") {
    return config.saves;
  }
  throw invalidConfig('storage.saves must be false, "standard-runtime", or { kind: "standard-runtime" }.');
}

function createRuntimeSaveOptions<TRuntimeData extends StandardRuntimeSnapshotContainer, TRetainedMessageEvent>(
  options: Omit<CreateStandardRuntimeSaveAdapterOptions<TRuntimeData, TRetainedMessageEvent>, "project"> | undefined,
): Omit<CreateStandardRuntimeSaveAdapterOptions<TRuntimeData, TRetainedMessageEvent>, "project"> {
  if (options !== undefined) {
    return options;
  }

  return {
    parseRuntimeData: (value) => (isStandardRuntimeSavePayload(value) ? (value as unknown as TRuntimeData) : null),
  };
}

function validateProject(project: TsuzuruConfig["project"]): StandardGameStorageProject {
  if (!isObjectRecord(project)) {
    throw invalidConfig("project must be provided to create standard game storage.");
  }
  return {
    id: validateNonEmptyString(project.id, "project.id"),
    version: validateNonEmptyString(project.version, "project.version"),
  };
}

function validateNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidConfig(`${label} must be a non-empty string.`);
  }
  return value;
}

function invalidConfig(message: string): StandardGameStorageConfigError {
  return new StandardGameStorageConfigError(`Invalid Tsuzuru standard game storage config: ${message}`);
}

function isRuntimeSnapshotLike(value: unknown): value is RuntimeSnapshot {
  if (!isObjectRecord(value) || value.version !== 2 || !isObjectRecord(value.pointer)) {
    return false;
  }
  const pointer = value.pointer;
  return typeof pointer.filePath === "string" && typeof pointer.instructionIndex === "number";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
