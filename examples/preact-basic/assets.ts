import type { StdTextSoundConfig } from "@tsuzuru/plugin-std-text-sound";

const textSound = {
  profiles: {
    narration: {
      type: "noise",
      color: "white",
      duration: "short",
      volume: 0.16,
    },
    mio: {
      type: "tone",
      note: "C5",
      waveform: "sine",
      duration: "short",
      volume: 0.5,
    },
    ren: {
      type: "mix",
      duration: "short",
      volume: 0.48,
      layers: [
        { type: "tone", note: "E4", waveform: "triangle", volume: 0.5 },
        { type: "noise", color: "pink", volume: 0.16 },
      ],
    },
    room: {
      type: "noise",
      color: "pink",
      duration: "short",
      volume: 0.18,
    },
  },
  defaults: {
    narration: "narration",
    dialogue: "room",
    characters: {
      mio: "mio",
      ren: "ren",
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
      mio_stand: {
        label: "美緒",
      },
      ren_stand: {
        label: "蓮",
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
