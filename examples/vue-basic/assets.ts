import type { StdTextSoundConfig } from "@tsuzuru/plugin-std-text-sound";

const textSound = {
  profiles: {
    narration: {
      type: "noise",
      color: "white",
      duration: "short",
      volume: 0.16,
    },
    tone: {
      type: "tone",
      note: "C5",
      waveform: "sine",
      duration: "short",
      volume: 0.5,
    },
    noize: {
      type: "noise",
      color: "white",
      duration: "short",
      volume: 0.22,
    },
    mix: {
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
    dialogue: "tone",
    characters: {
      tone: "tone",
      noize: "noize",
      mix: "mix",
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
      tone_stand: {
        url: "/assets/images/sprites/aoi-smile.svg",
        label: "トーン",
      },
      noize_stand: {
        url: "/assets/images/sprites/aoi-smile.svg",
        label: "ノイズ",
      },
      mix_stand: {
        url: "/assets/images/sprites/aoi-smile.svg",
        label: "ミックス",
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
