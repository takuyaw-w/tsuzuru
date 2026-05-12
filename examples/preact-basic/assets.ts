import type { StdTextSoundConfig } from "@tsuzuru/plugin-std-text-sound";

const textSound = {
  profiles: {
    narration: {
      type: "noise",
      color: "white",
      duration: "short",
      volume: 0.18,
    },
    mio: {
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
    dialogue: "mio",
    characters: {
      mio: "mio",
    },
  },
} satisfies StdTextSoundConfig;

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
  textSound,
} as const;

export type ExampleAssets = typeof assets;
