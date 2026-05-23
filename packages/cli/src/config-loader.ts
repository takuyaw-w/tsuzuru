import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { TsuzuruConfig } from "@tsuzuru/config";
import { createJiti } from "jiti";

const CONFIG_FILE_NAME = "tsuzuru.config.ts";

export class TsuzuruCliError extends Error {
  public override readonly name = "TsuzuruCliError";
}

export interface LoadedTsuzuruConfig {
  readonly config: TsuzuruConfig;
  readonly configPath: string;
  readonly configRoot: string;
}

export interface LoadTsuzuruConfigOptions {
  readonly cwd?: string;
}

export async function loadTsuzuruConfig(options: LoadTsuzuruConfigOptions = {}): Promise<LoadedTsuzuruConfig> {
  const configRoot = resolve(options.cwd ?? process.cwd());
  const configPath = resolve(configRoot, CONFIG_FILE_NAME);

  try {
    await access(configPath);
  } catch {
    throw new TsuzuruCliError(`Could not find ${CONFIG_FILE_NAME} in ${configRoot}.`);
  }

  const jiti = createJiti(configPath, {
    fsCache: false,
    moduleCache: false,
  });
  const loaded = await jiti.import<unknown>(configPath);
  const config = getDefaultExport(loaded);

  return {
    config: validateTsuzuruConfig(config),
    configPath,
    configRoot,
  };
}

function getDefaultExport(loaded: unknown): unknown {
  if (isRecord(loaded) && "default" in loaded) {
    return loaded.default;
  }
  return loaded;
}

function validateTsuzuruConfig(value: unknown): TsuzuruConfig {
  const errors: string[] = [];

  if (!isRecord(value)) {
    throw invalidConfig(["default export must be an object."]);
  }

  if (value.project !== undefined) {
    if (!isRecord(value.project)) {
      errors.push("project must be an object when provided.");
    } else {
      if (!isNonEmptyString(value.project.id)) {
        errors.push("project.id must be a non-empty string.");
      }

      if (!isNonEmptyString(value.project.version)) {
        errors.push("project.version must be a non-empty string.");
      }
    }
  }

  if (!isRecord(value.scenario)) {
    errors.push("scenario must be an object.");
  } else {
    if (!isNonEmptyString(value.scenario.entry)) {
      errors.push("scenario.entry must be a non-empty string.");
    }

    if (!Array.isArray(value.scenario.files)) {
      errors.push("scenario.files must be an array.");
    } else {
      for (const [index, filePattern] of value.scenario.files.entries()) {
        if (!isNonEmptyString(filePattern)) {
          errors.push(`scenario.files[${index}] must be a non-empty string.`);
        }
      }
    }
  }

  if (value.plugins !== undefined) {
    if (!Array.isArray(value.plugins)) {
      errors.push("plugins must be an array when provided.");
    } else {
      for (const [index, plugin] of value.plugins.entries()) {
        if (!isRecord(plugin) || !isNonEmptyString(plugin.name)) {
          errors.push(`plugins[${index}] must be an object with a non-empty name string.`);
        }
      }
    }
  }

  if (value.storage !== undefined) {
    validateStorageConfig(value.storage, errors);
  }

  if (errors.length > 0) {
    throw invalidConfig(errors);
  }

  return value as unknown as TsuzuruConfig;
}

function validateStorageConfig(value: unknown, errors: string[]): void {
  if (value === false) {
    return;
  }
  if (!isRecord(value)) {
    errors.push("storage must be an object or false when provided.");
    return;
  }

  if (value.kind !== undefined && value.kind !== "standard") {
    errors.push('storage.kind must be "standard" when provided.');
  }
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") {
    errors.push("storage.enabled must be a boolean when provided.");
  }
  if (value.prefix !== undefined && !isNonEmptyString(value.prefix)) {
    errors.push("storage.prefix must be a non-empty string when provided.");
  }
  if (value.slots !== undefined) {
    validateStorageSlots(value.slots, errors);
  }
  if (value.preferences !== undefined) {
    validateStoragePreferences(value.preferences, errors);
  }
  if (value.readTracking !== undefined) {
    validateStorageReadTracking(value.readTracking, errors);
  }
  if (value.saves !== undefined) {
    validateStorageSaves(value.saves, errors);
  }
}

function validateStorageSlots(value: unknown, errors: string[]): void {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) {
      errors.push("storage.slots must be a positive integer when it is a number.");
    }
    return;
  }

  if (!Array.isArray(value)) {
    errors.push("storage.slots must be a positive integer or an array.");
    return;
  }

  const seenIds = new Set<string>();
  for (const [index, slot] of value.entries()) {
    if (!isRecord(slot)) {
      errors.push(`storage.slots[${index}] must be an object.`);
      continue;
    }
    if (!isNonEmptyString(slot.id)) {
      errors.push(`storage.slots[${index}].id must be a non-empty string.`);
    } else if (seenIds.has(slot.id)) {
      errors.push(`storage.slots[${index}].id must be unique.`);
    } else {
      seenIds.add(slot.id);
    }
    if (!isNonEmptyString(slot.label)) {
      errors.push(`storage.slots[${index}].label must be a non-empty string.`);
    }
  }
}

function validateStoragePreferences(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("storage.preferences must be an object when provided.");
    return;
  }
  if (value.key !== undefined && !isNonEmptyString(value.key)) {
    errors.push("storage.preferences.key must be a non-empty string when provided.");
  }
  if (value.textSpeedOptions !== undefined) {
    if (!Array.isArray(value.textSpeedOptions) || value.textSpeedOptions.length === 0) {
      errors.push("storage.preferences.textSpeedOptions must be a non-empty number array when provided.");
    } else {
      for (const [index, option] of value.textSpeedOptions.entries()) {
        if (typeof option !== "number" || !Number.isFinite(option) || option <= 0) {
          errors.push(`storage.preferences.textSpeedOptions[${index}] must be a positive finite number.`);
        }
      }
    }
  }
  if (value.defaults !== undefined) {
    validateStoragePreferenceDefaults(value.defaults, errors);
  }
}

function validateStoragePreferenceDefaults(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("storage.preferences.defaults must be an object when provided.");
    return;
  }

  for (const key of ["textRevealEnabled", "textSoundEnabled"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      errors.push(`storage.preferences.defaults.${key} must be a boolean when provided.`);
    }
  }

  for (const key of ["textSpeedCharactersPerSecond", "textSoundVolume", "bgmVolume", "seVolume", "voiceVolume"]) {
    if (value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) {
      errors.push(`storage.preferences.defaults.${key} must be a finite number when provided.`);
    }
  }
}

function validateStorageReadTracking(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("storage.readTracking must be an object when provided.");
    return;
  }
  if (value.key !== undefined && !isNonEmptyString(value.key)) {
    errors.push("storage.readTracking.key must be a non-empty string when provided.");
  }
}

function validateStorageSaves(value: unknown, errors: string[]): void {
  if (value === false || value === "standard-runtime") {
    return;
  }
  if (!isRecord(value)) {
    errors.push('storage.saves must be false, "standard-runtime", or an object when provided.');
    return;
  }
  if (value.kind !== "standard-runtime") {
    errors.push('storage.saves.kind must be "standard-runtime".');
  }
  if (value.key !== undefined && !isNonEmptyString(value.key)) {
    errors.push("storage.saves.key must be a non-empty string when provided.");
  }
}

function invalidConfig(errors: readonly string[]): TsuzuruCliError {
  return new TsuzuruCliError(`Invalid tsuzuru.config.ts:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
