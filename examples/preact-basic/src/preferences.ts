import {
  createLocalStoragePreferencesStore,
  DEFAULT_STANDARD_GAME_PREFERENCES,
  STANDARD_GAME_TEXT_SPEED_OPTIONS,
  type StandardGamePreferences,
} from "@tsuzuru/standard-game-storage";

export const TEXT_SPEED_OPTIONS = STANDARD_GAME_TEXT_SPEED_OPTIONS;

export type TextSpeedCharactersPerSecond = (typeof TEXT_SPEED_OPTIONS)[number];

export interface ExamplePreferences extends StandardGamePreferences {
  readonly textSpeedCharactersPerSecond: TextSpeedCharactersPerSecond;
}

export const DEFAULT_EXAMPLE_PREFERENCES: ExamplePreferences = {
  ...DEFAULT_STANDARD_GAME_PREFERENCES,
  textSpeedCharactersPerSecond: 60,
};

export const PREFERENCES_STORAGE_KEY = "tsuzuru:example-preact-basic:preferences:v1";

const preferencesStore = createLocalStoragePreferencesStore({
  storageKey: PREFERENCES_STORAGE_KEY,
  defaults: DEFAULT_EXAMPLE_PREFERENCES,
  textSpeedOptions: TEXT_SPEED_OPTIONS,
});

export function loadPreferences(): ExamplePreferences {
  return preferencesStore.load() as ExamplePreferences;
}

export function savePreferences(preferences: ExamplePreferences): ExamplePreferences {
  return preferencesStore.save(preferences) as ExamplePreferences;
}

export function normalizePreferences(value: unknown): ExamplePreferences {
  return preferencesStore.normalize(value) as ExamplePreferences;
}
