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
      classroom: {
        label: "CLASSROOM",
        src: "/assets/backgrounds/classroom.svg",
      },
      hallway: {
        label: "HALLWAY",
        src: "/assets/backgrounds/hallway.svg",
      },
      library: {
        label: "LIBRARY",
        src: "/assets/backgrounds/library.svg",
      },
      rooftop: {
        label: "ROOFTOP",
        src: "/assets/backgrounds/rooftop.svg",
      },
      station: {
        label: "STATION",
        src: "/assets/backgrounds/station.svg",
      },
    },
    sprites: {
      tone_stand: {
        label: "トーン",
      },
      noize_stand: {
        label: "ノイズ",
      },
      mix_stand: {
        label: "ミックス",
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
