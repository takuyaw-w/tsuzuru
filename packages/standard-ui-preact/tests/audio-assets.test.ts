import { describe, expect, it } from "vitest";
import { createAudioAssetsWithVolume } from "../src/index.js";

describe("createAudioAssetsWithVolume", () => {
  it("maps audio asset paths to volume-aware asset objects", () => {
    expect(
      createAudioAssetsWithVolume(
        {
          daily_theme: "/assets/audio/bgm/daily_theme.mp3",
          ending: "/assets/audio/bgm/ending.mp3",
        },
        0.35,
      ),
    ).toEqual({
      daily_theme: { src: "/assets/audio/bgm/daily_theme.mp3", volume: 0.35 },
      ending: { src: "/assets/audio/bgm/ending.mp3", volume: 0.35 },
    });
  });

  it("keeps empty asset maps empty", () => {
    expect(createAudioAssetsWithVolume({}, 0.8)).toEqual({});
  });
});
