import type { TsuzuruHtmlAssets } from "@tsuzuru/html";
import { describe, expect, it } from "vitest";
import { createHtmlBasicBacklogEntry } from "../src/backlog.js";
import { createHtmlBasicGallerySections } from "../src/gallery.js";
import {
  HTML_BASIC_SETTINGS_STORAGE_KEY,
  loadHtmlBasicSettings,
  saveHtmlBasicSettings,
  toHtmlBasicSettingsStyle,
} from "../src/settings.js";

describe("html-basic helpers", () => {
  it("creates backlog entries from narration and dialogue events", () => {
    expect(
      createHtmlBasicBacklogEntry(
        {
          type: "narration",
          lines: [{ text: "Line 1" }, { text: "Line 2" }],
        },
        1,
      ),
    ).toEqual({
      id: 1,
      kind: "narration",
      speakerName: null,
      text: "Line 1\nLine 2",
    });

    expect(
      createHtmlBasicBacklogEntry(
        {
          type: "dialogue",
          speaker: "mio",
          lines: [{ text: "Hello." }],
        },
        2,
        { mio: "美緒" },
      ),
    ).toEqual({
      id: 2,
      kind: "dialogue",
      speakerName: "美緒",
      text: "Hello.",
    });
  });

  it("loads and saves settings with normalization", () => {
    const storage = new MapStorage();

    const saved = saveHtmlBasicSettings(
      {
        textFontSize: 2,
        messageWindowOpacity: 0.1,
        audioNoticesVisible: false,
      },
      storage,
    );

    expect(saved).toEqual({
      textFontSize: 1.35,
      messageWindowOpacity: 0.55,
      audioNoticesVisible: false,
    });
    expect(loadHtmlBasicSettings(storage)).toEqual(saved);
    expect(storage.getItem(HTML_BASIC_SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(saved));
    expect(toHtmlBasicSettingsStyle(saved)).toEqual({
      "--html-basic-message-font-size": "1.35rem",
      "--html-basic-message-window-opacity": "0.55",
    });
  });

  it("creates gallery sections from visual and audio assets", () => {
    const sections = createHtmlBasicGallerySections(testAssets);

    expect(sections.map((section) => section.title)).toEqual(["Backgrounds", "Sprites", "Audio"]);
    expect(sections[0]?.items).toEqual([
      {
        id: "room",
        src: "https://example.test/assets/room.svg",
        alt: "Room",
      },
    ]);
    expect(sections[1]?.items[0]?.id).toBe("mio_smile");
    expect(sections[2]?.items.map((item) => item.id)).toEqual(["daily_theme", "page", "mio_001"]);
  });
});

class MapStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const testAssets: TsuzuruHtmlAssets = {
  version: 1,
  visual: {
    backgrounds: {
      room: { src: "https://example.test/assets/room.svg", alt: "Room" },
    },
    sprites: {
      mio_smile: { src: "https://example.test/assets/mio.svg", alt: "Mio" },
    },
  },
  audio: {
    bgm: { daily_theme: { src: "https://example.test/assets/bgm.mp3" } },
    se: { page: { src: "https://example.test/assets/page.mp3" } },
    voice: { mio_001: { src: "https://example.test/assets/mio.mp3" } },
  },
};
