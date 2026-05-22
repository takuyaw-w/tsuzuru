export const STANDARD_GAME_TEXT_SPEED_OPTIONS = [30, 60, 120] as const;

export type StandardGameTextSpeedCharactersPerSecond = (typeof STANDARD_GAME_TEXT_SPEED_OPTIONS)[number];

export interface StandardGamePreferences {
  readonly textRevealEnabled: boolean;
  readonly textSpeedCharactersPerSecond: number;
  readonly textSoundEnabled: boolean;
  readonly textSoundVolume: number;
  readonly bgmVolume: number;
  readonly seVolume: number;
  readonly voiceVolume: number;
}

export const DEFAULT_STANDARD_GAME_PREFERENCES: StandardGamePreferences = {
  textRevealEnabled: true,
  textSpeedCharactersPerSecond: 60,
  textSoundEnabled: true,
  textSoundVolume: 0.55,
  bgmVolume: 0.6,
  seVolume: 0.8,
  voiceVolume: 0.9,
};

export interface StandardGameStorageLike {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export interface NormalizeStandardGamePreferencesOptions {
  readonly defaults?: Partial<StandardGamePreferences>;
  readonly textSpeedOptions?: readonly number[];
}

export interface CreateLocalStoragePreferencesStoreOptions extends NormalizeStandardGamePreferencesOptions {
  readonly storageKey: string;
  readonly storage?: StandardGameStorageLike | null;
}

export interface StandardGamePreferencesStore {
  readonly load: () => StandardGamePreferences;
  readonly save: (preferences: StandardGamePreferences) => StandardGamePreferences;
  readonly normalize: (value: unknown) => StandardGamePreferences;
}

export function normalizeStandardGamePreferences(
  value: unknown,
  options: NormalizeStandardGamePreferencesOptions = {},
): StandardGamePreferences {
  const defaults = resolveStandardGamePreferencesDefaults(options);
  const textSpeedOptions = options.textSpeedOptions ?? STANDARD_GAME_TEXT_SPEED_OPTIONS;

  if (!isObjectRecord(value)) {
    return defaults;
  }

  return {
    textRevealEnabled:
      typeof value.textRevealEnabled === "boolean" ? value.textRevealEnabled : defaults.textRevealEnabled,
    textSpeedCharactersPerSecond: isAllowedTextSpeed(value.textSpeedCharactersPerSecond, textSpeedOptions)
      ? value.textSpeedCharactersPerSecond
      : defaults.textSpeedCharactersPerSecond,
    textSoundEnabled: typeof value.textSoundEnabled === "boolean" ? value.textSoundEnabled : defaults.textSoundEnabled,
    textSoundVolume: isUnitVolume(value.textSoundVolume) ? value.textSoundVolume : defaults.textSoundVolume,
    bgmVolume: isUnitVolume(value.bgmVolume) ? value.bgmVolume : defaults.bgmVolume,
    seVolume: isUnitVolume(value.seVolume) ? value.seVolume : defaults.seVolume,
    voiceVolume: isUnitVolume(value.voiceVolume) ? value.voiceVolume : defaults.voiceVolume,
  };
}

export function createLocalStoragePreferencesStore(
  options: CreateLocalStoragePreferencesStoreOptions,
): StandardGamePreferencesStore {
  return {
    load() {
      const storage = resolveStorage(options.storage);
      if (storage === null) {
        return normalizeStandardGamePreferences(undefined, options);
      }

      let rawValue: string | null;
      try {
        rawValue = storage.getItem(options.storageKey);
      } catch {
        return normalizeStandardGamePreferences(undefined, options);
      }

      if (rawValue === null) {
        return normalizeStandardGamePreferences(undefined, options);
      }

      try {
        return normalizeStandardGamePreferences(JSON.parse(rawValue), options);
      } catch {
        return normalizeStandardGamePreferences(undefined, options);
      }
    },
    save(preferences) {
      const normalizedPreferences = normalizeStandardGamePreferences(preferences, options);
      const storage = resolveStorage(options.storage);
      if (storage === null) {
        return normalizedPreferences;
      }

      try {
        storage.setItem(options.storageKey, JSON.stringify(normalizedPreferences));
      } catch {
        return normalizedPreferences;
      }

      return normalizedPreferences;
    },
    normalize(value) {
      return normalizeStandardGamePreferences(value, options);
    },
  };
}

function resolveStandardGamePreferencesDefaults(
  options: NormalizeStandardGamePreferencesOptions,
): StandardGamePreferences {
  const baseDefaults = DEFAULT_STANDARD_GAME_PREFERENCES;
  const defaults = options.defaults;
  const textSpeedOptions = options.textSpeedOptions ?? STANDARD_GAME_TEXT_SPEED_OPTIONS;

  if (defaults === undefined) {
    return baseDefaults;
  }

  return {
    textRevealEnabled:
      typeof defaults.textRevealEnabled === "boolean" ? defaults.textRevealEnabled : baseDefaults.textRevealEnabled,
    textSpeedCharactersPerSecond: isAllowedTextSpeed(defaults.textSpeedCharactersPerSecond, textSpeedOptions)
      ? defaults.textSpeedCharactersPerSecond
      : baseDefaults.textSpeedCharactersPerSecond,
    textSoundEnabled:
      typeof defaults.textSoundEnabled === "boolean" ? defaults.textSoundEnabled : baseDefaults.textSoundEnabled,
    textSoundVolume: isUnitVolume(defaults.textSoundVolume) ? defaults.textSoundVolume : baseDefaults.textSoundVolume,
    bgmVolume: isUnitVolume(defaults.bgmVolume) ? defaults.bgmVolume : baseDefaults.bgmVolume,
    seVolume: isUnitVolume(defaults.seVolume) ? defaults.seVolume : baseDefaults.seVolume,
    voiceVolume: isUnitVolume(defaults.voiceVolume) ? defaults.voiceVolume : baseDefaults.voiceVolume,
  };
}

function isAllowedTextSpeed(value: unknown, options: readonly number[]): value is number {
  return typeof value === "number" && options.includes(value);
}

function isUnitVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDefaultLocalStorage(): StandardGameStorageLike | null {
  try {
    const global = globalThis as { readonly localStorage?: StandardGameStorageLike };
    return global.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveStorage(storage: StandardGameStorageLike | null | undefined): StandardGameStorageLike | null {
  return storage === undefined ? getDefaultLocalStorage() : storage;
}
