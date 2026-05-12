import type { StdTextSoundConfig } from "@tsuzuru/plugin-std-text-sound";

const textSound = {
  profiles: {
    narration: {
      type: "noise",
      color: "white",
      duration: "short",
      volume: 0.18,
    },
    aoi: {
      type: "mix",
      duration: "short",
      volume: 0.55,
      layers: [
        { type: "tone", note: "E5", waveform: "triangle", volume: 0.7 },
        { type: "noise", color: "white", volume: 0.12 },
      ],
    },
  },
  defaults: {
    narration: "narration",
    dialogue: "aoi",
    characters: {
      aoi: "aoi",
    },
  },
} satisfies StdTextSoundConfig;

export const assets = {
  visual: {
    backgrounds: {
      riverside: {
        url: "/assets/images/backgrounds/riverside.svg",
        label: "Riverside",
      },
    },
    sprites: {
      aoi_smile: {
        url: "/assets/images/sprites/aoi-smile.svg",
        label: "葵",
      },
    },
  },
  audio: {
    bgm: {
      vue_theme: "/assets/audio/bgm/vue_theme.mp3",
    },
    se: {
      page: "/assets/audio/se/page.mp3",
    },
    voice: {
      aoi_001: "/assets/audio/voice/aoi_001.mp3",
    },
  },
  textSound,
} as const;

export type ExampleAssets = typeof assets;
