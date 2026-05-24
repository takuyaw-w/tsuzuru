import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXAMPLE_PREFERENCES,
  DEFAULT_MESSAGE_PRESENTATION_MODE,
  DEFAULT_MESSAGE_PRESENTATION_SPEAKER_MODE,
  type ExamplePreferences,
  gameStorage,
  loadMessagePresentationMode,
  loadMessagePresentationSpeakerMode,
  MESSAGE_PRESENTATION_MODE_STORAGE_KEY,
  MESSAGE_PRESENTATION_SPEAKER_MODE_STORAGE_KEY,
  saveMessagePresentationMode,
  saveMessagePresentationSpeakerMode,
  TEXT_SPEED_OPTIONS,
} from "../src/App.js";

const PREFERENCES_STORAGE_KEY = gameStorage.keys.preferences;

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
    expect(MESSAGE_PRESENTATION_MODE_STORAGE_KEY).toBe("tsuzuru:example-preact-basic:messagePresentationMode");
    expect(MESSAGE_PRESENTATION_SPEAKER_MODE_STORAGE_KEY).toBe(
      "tsuzuru:example-preact-basic:messagePresentationSpeakerMode",
    );
    expect(TEXT_SPEED_OPTIONS).toEqual([30, 60, 120]);
    expect(DEFAULT_MESSAGE_PRESENTATION_MODE).toBe("dialogue");
    expect(DEFAULT_MESSAGE_PRESENTATION_SPEAKER_MODE).toBe("inline");
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
      gameStorage.preferences.normalize({
        ...validPreferences,
        textSpeedCharactersPerSecond: 90,
        bgmVolume: "loud",
      }) as ExamplePreferences,
    ).toEqual({
      ...validPreferences,
      textSpeedCharactersPerSecond: DEFAULT_EXAMPLE_PREFERENCES.textSpeedCharactersPerSecond,
      bgmVolume: DEFAULT_EXAMPLE_PREFERENCES.bgmVolume,
    });
  });

  it("loads and saves through the example preferences storage key", () => {
    const storage = stubPreferencesStorage();

    expect(gameStorage.preferences.save(validPreferences)).toEqual(validPreferences);
    expect(storage.getItem(PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify(validPreferences));
    expect(gameStorage.preferences.load()).toEqual(validPreferences);
  });

  it("falls back to defaults when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("window", {});

    expect(gameStorage.preferences.load()).toEqual(DEFAULT_EXAMPLE_PREFERENCES);
    expect(gameStorage.preferences.save(validPreferences)).toEqual(validPreferences);
  });

  it("falls back without throwing when localStorage access fails", () => {
    const localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
      getItem() {
        throw new Error("localStorage unavailable");
      },
      setItem() {
        throw new Error("localStorage unavailable");
      },
      removeItem() {
        throw new Error("localStorage unavailable");
      },
    };
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", { localStorage });

    expect(gameStorage.preferences.load()).toEqual(DEFAULT_EXAMPLE_PREFERENCES);
    expect(gameStorage.preferences.save(validPreferences)).toEqual(validPreferences);
  });

  it("loads and saves message presentation settings outside standard preferences", () => {
    const storage = stubPreferencesStorage();

    expect(loadMessagePresentationMode()).toBe("dialogue");
    expect(loadMessagePresentationSpeakerMode()).toBe("inline");

    expect(saveMessagePresentationMode("novel")).toBe("novel");
    expect(saveMessagePresentationSpeakerMode("block")).toBe("block");
    expect(storage.getItem(MESSAGE_PRESENTATION_MODE_STORAGE_KEY)).toBe("novel");
    expect(storage.getItem(MESSAGE_PRESENTATION_SPEAKER_MODE_STORAGE_KEY)).toBe("block");
    expect(loadMessagePresentationMode()).toBe("novel");
    expect(loadMessagePresentationSpeakerMode()).toBe("block");
  });

  it("falls back for invalid message presentation settings", () => {
    const storage = stubPreferencesStorage();
    storage.setItem(MESSAGE_PRESENTATION_MODE_STORAGE_KEY, "unknown");
    storage.setItem(MESSAGE_PRESENTATION_SPEAKER_MODE_STORAGE_KEY, "label");

    expect(loadMessagePresentationMode()).toBe("dialogue");
    expect(loadMessagePresentationSpeakerMode()).toBe("inline");
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
