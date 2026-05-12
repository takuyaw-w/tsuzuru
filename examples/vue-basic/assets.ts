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
  textSound: {
    soft: {
      type: "tone",
      frequencyHz: 660,
      durationMs: 32,
    },
  },
} as const;

export type ExampleAssets = typeof assets;
