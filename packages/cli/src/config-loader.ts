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

  if (errors.length > 0) {
    throw invalidConfig(errors);
  }

  return value as unknown as TsuzuruConfig;
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
