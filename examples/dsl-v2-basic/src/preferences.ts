export const TEXT_SPEED_OPTIONS = [30, 60, 120] as const;

export type TextSpeedCharactersPerSecond = (typeof TEXT_SPEED_OPTIONS)[number];

export interface ExamplePreferences {
  readonly textRevealEnabled: boolean;
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
  readonly bgmVolume: number;
  readonly seVolume: number;
  readonly voiceVolume: number;
}

export const DEFAULT_EXAMPLE_PREFERENCES: ExamplePreferences = {
  textRevealEnabled: true,
  textSpeedCharactersPerSecond: 60,
  bgmVolume: 0.6,
  seVolume: 0.8,
  voiceVolume: 0.9,
};

export const PREFERENCES_STORAGE_KEY = "tsuzuru:example-dsl-v2-basic:preferences:v1";

export function loadPreferences(): ExamplePreferences {
  const storage = getLocalStorage();
  if (storage === null) {
    return DEFAULT_EXAMPLE_PREFERENCES;
  }

  const rawValue = storage.getItem(PREFERENCES_STORAGE_KEY);
  if (rawValue === null) {
    return DEFAULT_EXAMPLE_PREFERENCES;
  }

  try {
    return normalizePreferences(JSON.parse(rawValue));
  } catch {
    return DEFAULT_EXAMPLE_PREFERENCES;
  }
}

export function savePreferences(preferences: ExamplePreferences): ExamplePreferences {
  const normalizedPreferences = normalizePreferences(preferences);
  const storage = getLocalStorage();
  if (storage === null) {
    return normalizedPreferences;
  }

  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizedPreferences));
  } catch {
    return normalizedPreferences;
  }
  return normalizedPreferences;
}

export function normalizePreferences(value: unknown): ExamplePreferences {
  if (!isRecord(value)) {
    return DEFAULT_EXAMPLE_PREFERENCES;
  }

  return {
    textRevealEnabled:
      typeof value.textRevealEnabled === "boolean"
        ? value.textRevealEnabled
        : DEFAULT_EXAMPLE_PREFERENCES.textRevealEnabled,
    textSpeedCharactersPerSecond: isTextSpeedCharactersPerSecond(value.textSpeedCharactersPerSecond)
      ? value.textSpeedCharactersPerSecond
      : DEFAULT_EXAMPLE_PREFERENCES.textSpeedCharactersPerSecond,
    bgmVolume: isUnitVolume(value.bgmVolume) ? value.bgmVolume : DEFAULT_EXAMPLE_PREFERENCES.bgmVolume,
    seVolume: isUnitVolume(value.seVolume) ? value.seVolume : DEFAULT_EXAMPLE_PREFERENCES.seVolume,
    voiceVolume: isUnitVolume(value.voiceVolume) ? value.voiceVolume : DEFAULT_EXAMPLE_PREFERENCES.voiceVolume,
  };
}

function isTextSpeedCharactersPerSecond(value: unknown): value is TextSpeedCharactersPerSecond {
  return typeof value === "number" && TEXT_SPEED_OPTIONS.includes(value as TextSpeedCharactersPerSecond);
}

function isUnitVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
