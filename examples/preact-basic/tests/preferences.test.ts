import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXAMPLE_PREFERENCES,
  type ExamplePreferences,
  loadPreferences,
  normalizePreferences,
  PREFERENCES_STORAGE_KEY,
  savePreferences,
  TEXT_SPEED_OPTIONS,
} from "../src/preferences.js";

const validPreferences = {
  textRevealEnabled: false,
  textSpeedCharactersPerSecond: 120,
  textSoundEnabled: false,
  textSoundVolume: 0.1,
  bgmVolume: 0.2,
  seVolume: 0.3,
  voiceVolume: 0.4,
} satisfies ExamplePreferences;

describe("preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the example preferences policy stable", () => {
    expect(PREFERENCES_STORAGE_KEY).toBe("tsuzuru:example-preact-basic:preferences:v1");
    expect(TEXT_SPEED_OPTIONS).toEqual([30, 60, 120]);
    expect(DEFAULT_EXAMPLE_PREFERENCES).toEqual({
      textRevealEnabled: true,
      textSpeedCharactersPerSecond: 60,
      textSoundEnabled: true,
      textSoundVolume: 0.55,
      bgmVolume: 0.6,
      seVolume: 0.8,
      voiceVolume: 0.9,
    });
  });

  it("normalizes preferences with example defaults and text speed options", () => {
    expect(
      normalizePreferences({
        ...validPreferences,
        textSpeedCharactersPerSecond: 90,
        bgmVolume: "loud",
      }),
    ).toEqual({
      ...validPreferences,
      textSpeedCharactersPerSecond: DEFAULT_EXAMPLE_PREFERENCES.textSpeedCharactersPerSecond,
      bgmVolume: DEFAULT_EXAMPLE_PREFERENCES.bgmVolume,
    });
  });

  it("loads and saves through the example preferences storage key", () => {
    const storage = stubPreferencesStorage();

    expect(savePreferences(validPreferences)).toEqual(validPreferences);
    expect(storage.getItem(PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify(validPreferences));
    expect(loadPreferences()).toEqual(validPreferences);
  });
});

function stubPreferencesStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  const localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}
