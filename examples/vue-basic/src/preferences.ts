export const TEXT_SPEED_OPTIONS = [30, 60, 120] as const;

export type TextSpeedCharactersPerSecond = (typeof TEXT_SPEED_OPTIONS)[number];

export interface ExamplePreferences {
  readonly messageScale: number;
  readonly showAudioNotices: boolean;
  readonly textRevealEnabled: boolean;
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
  readonly textSoundEnabled: boolean;
  readonly textSoundVolume: number;
}

export const DEFAULT_EXAMPLE_PREFERENCES: ExamplePreferences = {
  messageScale: 1,
  showAudioNotices: true,
  textRevealEnabled: true,
  textSpeedCharactersPerSecond: 60,
  textSoundEnabled: true,
  textSoundVolume: 0.55,
};

export const PREFERENCES_STORAGE_KEY = "tsuzuru:example-vue-basic:preferences:v1";

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
    messageScale: isMessageScale(value.messageScale) ? value.messageScale : DEFAULT_EXAMPLE_PREFERENCES.messageScale,
    showAudioNotices:
      typeof value.showAudioNotices === "boolean"
        ? value.showAudioNotices
        : DEFAULT_EXAMPLE_PREFERENCES.showAudioNotices,
    textRevealEnabled:
      typeof value.textRevealEnabled === "boolean"
        ? value.textRevealEnabled
        : DEFAULT_EXAMPLE_PREFERENCES.textRevealEnabled,
    textSpeedCharactersPerSecond: isTextSpeedCharactersPerSecond(value.textSpeedCharactersPerSecond)
      ? value.textSpeedCharactersPerSecond
      : DEFAULT_EXAMPLE_PREFERENCES.textSpeedCharactersPerSecond,
    textSoundEnabled:
      typeof value.textSoundEnabled === "boolean"
        ? value.textSoundEnabled
        : DEFAULT_EXAMPLE_PREFERENCES.textSoundEnabled,
    textSoundVolume: isUnitVolume(value.textSoundVolume)
      ? value.textSoundVolume
      : DEFAULT_EXAMPLE_PREFERENCES.textSoundVolume,
  };
}

function isTextSpeedCharactersPerSecond(value: unknown): value is TextSpeedCharactersPerSecond {
  return typeof value === "number" && TEXT_SPEED_OPTIONS.includes(value as TextSpeedCharactersPerSecond);
}

function isMessageScale(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.9 && value <= 1.3;
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
