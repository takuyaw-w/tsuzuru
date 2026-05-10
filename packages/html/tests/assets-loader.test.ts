import { describe, expect, it } from "vitest";
import {
  loadTsuzuruHtmlAssets,
  normalizeTsuzuruHtmlAssetsManifest,
  TsuzuruHtmlAssetsLoadError,
  type TsuzuruHtmlFetch,
} from "../src/index.js";

describe("loadTsuzuruHtmlAssets", () => {
  it("loads assets.json and resolves URLs from manifest baseUrl", async () => {
    const fetch = createJsonFetch({
      version: 1,
      baseUrl: "./static/",
      visual: {
        backgrounds: {
          room: { src: "images/room.svg", alt: "Room" },
        },
      },
      audio: {
        bgm: {
          daily_theme: { src: "audio/daily-theme.mp3" },
        },
      },
    });

    const assets = await loadTsuzuruHtmlAssets("/assets/assets.json", {
      fetch,
      baseUrl: "https://example.test/game/",
    });

    expect(assets.visual.backgrounds.room).toEqual({
      src: "https://example.test/assets/static/images/room.svg",
      alt: "Room",
    });
    expect(assets.audio.bgm.daily_theme?.src).toBe("https://example.test/assets/static/audio/daily-theme.mp3");
  });

  it("rejects unsupported manifest versions", () => {
    expect(() => normalizeTsuzuruHtmlAssetsManifest({ version: 2 }, "https://example.test/assets/assets.json")).toThrow(
      TsuzuruHtmlAssetsLoadError,
    );
  });

  it("rejects invalid asset entries", () => {
    expect(() =>
      normalizeTsuzuruHtmlAssetsManifest(
        {
          version: 1,
          visual: {
            backgrounds: {
              room: { src: "" },
            },
          },
        },
        "https://example.test/assets/assets.json",
      ),
    ).toThrow(TsuzuruHtmlAssetsLoadError);
  });
});

function createJsonFetch(value: unknown): TsuzuruHtmlFetch {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(value),
  });
}
