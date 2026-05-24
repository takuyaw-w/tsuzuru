import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import type { TsuzuruConfig } from "./index.js";

const CONFIG_FILE_NAME = "tsuzuru.config.ts";
const STANDARD_STORAGE_TEXT_SPEED_OPTIONS = [30, 60, 120] as const;

export class TsuzuruConfigLoadError extends Error {
  public override readonly name = "TsuzuruConfigLoadError";
}

export interface LoadedTsuzuruConfig {
  readonly config: TsuzuruConfig;
  readonly configPath: string;
  readonly configRoot: string;
}

export interface LoadTsuzuruConfigOptions {
  readonly cwd?: string;
  readonly configFile?: string;
}

export function resolveTsuzuruConfigPath(options: LoadTsuzuruConfigOptions = {}): string {
  const configRoot = resolve(options.cwd ?? process.cwd());
  return resolveConfigPath(configRoot, options.configFile);
}

export async function loadTsuzuruConfig(options: LoadTsuzuruConfigOptions = {}): Promise<LoadedTsuzuruConfig> {
  const configRoot = resolve(options.cwd ?? process.cwd());
  const configPath = resolveConfigPath(configRoot, options.configFile);

  try {
    await access(configPath);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw new TsuzuruConfigLoadError(`Failed to access ${configPath}: ${formatErrorMessage(error)}`, {
        cause: error,
      });
    }
    throw new TsuzuruConfigLoadError(`Could not find ${configFileLabel(options.configFile)} in ${configRoot}.`);
  }

  return loadTsuzuruConfigFile(configRoot, configPath);
}

export async function loadOptionalTsuzuruConfig(
  options: LoadTsuzuruConfigOptions = {},
): Promise<LoadedTsuzuruConfig | null> {
  const configRoot = resolve(options.cwd ?? process.cwd());
  const configPath = resolveConfigPath(configRoot, options.configFile);

  try {
    await access(configPath);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw new TsuzuruConfigLoadError(`Failed to access ${configPath}: ${formatErrorMessage(error)}`, {
        cause: error,
      });
    }
    return null;
  }

  return loadTsuzuruConfigFile(configRoot, configPath);
}

export function validateTsuzuruConfig(value: unknown): TsuzuruConfig {
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

async function loadTsuzuruConfigFile(configRoot: string, configPath: string): Promise<LoadedTsuzuruConfig> {
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

function resolveConfigPath(configRoot: string, configFile = CONFIG_FILE_NAME): string {
  return resolve(configRoot, configFile);
}

function configFileLabel(configFile: string | undefined): string {
  return configFile ?? CONFIG_FILE_NAME;
}

function isMissingFileError(error: unknown): boolean {
  return isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getDefaultExport(loaded: unknown): unknown {
  if (isRecord(loaded) && "default" in loaded) {
    return loaded.default;
  }
  return loaded;
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
  const textSpeedOptions = validateStorageTextSpeedOptions(value.textSpeedOptions, errors);
  if (value.defaults !== undefined) {
    validateStoragePreferenceDefaults(value.defaults, textSpeedOptions, errors);
  }
}

function validateStorageTextSpeedOptions(value: unknown, errors: string[]): readonly number[] {
  if (value === undefined) {
    return STANDARD_STORAGE_TEXT_SPEED_OPTIONS;
  }
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("storage.preferences.textSpeedOptions must be a non-empty number array when provided.");
    return STANDARD_STORAGE_TEXT_SPEED_OPTIONS;
  }

  const options: number[] = [];
  for (const [index, option] of value.entries()) {
    if (typeof option !== "number" || !Number.isFinite(option) || option <= 0) {
      errors.push(`storage.preferences.textSpeedOptions[${index}] must be a positive finite number.`);
    } else {
      options.push(option);
    }
  }
  return options.length === 0 ? STANDARD_STORAGE_TEXT_SPEED_OPTIONS : options;
}

function validateStoragePreferenceDefaults(
  value: unknown,
  textSpeedOptions: readonly number[],
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push("storage.preferences.defaults must be an object when provided.");
    return;
  }

  for (const key of ["textRevealEnabled", "textSoundEnabled"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      errors.push(`storage.preferences.defaults.${key} must be a boolean when provided.`);
    }
  }

  if (value.textSpeedCharactersPerSecond !== undefined) {
    if (
      typeof value.textSpeedCharactersPerSecond !== "number" ||
      !textSpeedOptions.includes(value.textSpeedCharactersPerSecond)
    ) {
      errors.push("storage.preferences.defaults.textSpeedCharactersPerSecond must be one of textSpeedOptions.");
    }
  }

  for (const key of ["textSoundVolume", "bgmVolume", "seVolume", "voiceVolume"]) {
    const volume = value[key];
    if (volume !== undefined) {
      if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1) {
        errors.push(`storage.preferences.defaults.${key} must be a number between 0 and 1 when provided.`);
      }
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

function invalidConfig(errors: readonly string[]): TsuzuruConfigLoadError {
  return new TsuzuruConfigLoadError(`Invalid tsuzuru.config.ts:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
