export const assets = {
  visual: {
    backgrounds: {
      station: {
        className: "visual-layer__background--station",
        label: "STATION",
      },
    },
    sprites: {
      mio_smile: {
        className: "visual-layer__sprite--mio-smile",
        label: "美緒",
      },
    },
  },
  audio: {
    bgm: {
      daily_theme: "/assets/audio/bgm/daily_theme.mp3",
    },
    se: {
      page: "/assets/audio/se/page.mp3",
    },
    voice: {
      mio_001: "/assets/audio/voice/mio_001.mp3",
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
