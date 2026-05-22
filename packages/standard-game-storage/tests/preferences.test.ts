import { describe, expect, it } from "vitest";
import {
  createLocalStoragePreferencesStore,
  DEFAULT_STANDARD_GAME_PREFERENCES,
  normalizeStandardGamePreferences,
  STANDARD_GAME_TEXT_SPEED_OPTIONS,
  type StandardGamePreferences,
  type StandardGameStorageLike,
} from "../src/index.js";

const validPreferences = {
  textRevealEnabled: false,
  textSpeedCharactersPerSecond: 120,
  textSoundEnabled: false,
  textSoundVolume: 0.1,
  bgmVolume: 0.2,
  seVolume: 0.3,
  voiceVolume: 0.4,
} satisfies StandardGamePreferences;

describe("standard game preferences", () => {
  it("returns the default preferences", () => {
    expect(normalizeStandardGamePreferences(undefined)).toEqual(DEFAULT_STANDARD_GAME_PREFERENCES);
    expect(STANDARD_GAME_TEXT_SPEED_OPTIONS).toEqual([30, 60, 120]);
  });

  it("keeps valid preferences when normalizing", () => {
    expect(normalizeStandardGamePreferences(validPreferences)).toEqual(validPreferences);
  });

  it("falls invalid booleans back to defaults", () => {
    expect(
      normalizeStandardGamePreferences({
        ...validPreferences,
        textRevealEnabled: "yes",
        textSoundEnabled: 1,
      }),
    ).toEqual({
      ...validPreferences,
      textRevealEnabled: DEFAULT_STANDARD_GAME_PREFERENCES.textRevealEnabled,
      textSoundEnabled: DEFAULT_STANDARD_GAME_PREFERENCES.textSoundEnabled,
    });
  });

  it("falls invalid text speed back to the default", () => {
    expect(
      normalizeStandardGamePreferences({
        ...validPreferences,
        textSpeedCharactersPerSecond: 90,
      }),
    ).toEqual({
      ...validPreferences,
      textSpeedCharactersPerSecond: DEFAULT_STANDARD_GAME_PREFERENCES.textSpeedCharactersPerSecond,
    });
  });

  it("falls invalid volumes back to defaults", () => {
    expect(
      normalizeStandardGamePreferences({
        ...validPreferences,
        textSoundVolume: -0.1,
        bgmVolume: 1.1,
        seVolume: Number.NaN,
        voiceVolume: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      ...validPreferences,
      textSoundVolume: DEFAULT_STANDARD_GAME_PREFERENCES.textSoundVolume,
      bgmVolume: DEFAULT_STANDARD_GAME_PREFERENCES.bgmVolume,
      seVolume: DEFAULT_STANDARD_GAME_PREFERENCES.seVolume,
      voiceVolume: DEFAULT_STANDARD_GAME_PREFERENCES.voiceVolume,
    });
  });

  it("keeps valid sibling fields when another field is invalid", () => {
    expect(
      normalizeStandardGamePreferences({
        ...validPreferences,
        bgmVolume: "loud",
      }),
    ).toEqual({
      ...validPreferences,
      bgmVolume: DEFAULT_STANDARD_GAME_PREFERENCES.bgmVolume,
    });
  });

  it("loads defaults for malformed JSON", () => {
    const store = createLocalStoragePreferencesStore({
      storageKey: "preferences",
      storage: createMemoryStorage([["preferences", "not-json"]]),
    });

    expect(store.load()).toEqual(DEFAULT_STANDARD_GAME_PREFERENCES);
  });

  it("loads defaults when storage is unavailable", () => {
    const store = createLocalStoragePreferencesStore({
      storageKey: "preferences",
      storage: null,
    });

    expect(store.load()).toEqual(DEFAULT_STANDARD_GAME_PREFERENCES);
  });

  it("loads defaults when getItem throws", () => {
    const store = createLocalStoragePreferencesStore({
      storageKey: "preferences",
      storage: {
        getItem() {
          throw new Error("storage unavailable");
        },
        setItem() {
          throw new Error("unused");
        },
      },
    });

    expect(store.load()).toEqual(DEFAULT_STANDARD_GAME_PREFERENCES);
  });

  it("returns normalized preferences when setItem throws", () => {
    const store = createLocalStoragePreferencesStore({
      storageKey: "preferences",
      storage: {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error("quota exceeded");
        },
      },
    });

    expect(
      store.save({
        ...validPreferences,
        bgmVolume: "loud" as unknown as number,
      }),
    ).toEqual({
      ...validPreferences,
      bgmVolume: DEFAULT_STANDARD_GAME_PREFERENCES.bgmVolume,
    });
  });

  it("round trips through localStorage-like storage", () => {
    const storage = createMemoryStorage();
    const store = createLocalStoragePreferencesStore({
      storageKey: "preferences",
      storage,
    });

    expect(store.save(validPreferences)).toEqual(validPreferences);
    expect(store.load()).toEqual(validPreferences);
  });
});

function createMemoryStorage(initialValues: readonly (readonly [string, string])[] = []): StandardGameStorageLike {
  const values = new Map(initialValues);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
