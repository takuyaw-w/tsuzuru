import type { TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

// Edit this file when you add your own images or audio.
//
// The keys are the ids used by scenario/main.tzr:
//   bg classroom
//   show mio_smile at center
export const assets = {
  visual: {
    backgrounds: {
      classroom: {
        src: "/assets/images/classroom.svg",
        label: "教室",
        className: "starter-background starter-background--classroom",
      },
      station: {
        src: "/assets/images/station.svg",
        label: "駅前",
        className: "starter-background starter-background--station",
      },
      room: {
        src: "/assets/images/room.svg",
        label: "部屋",
        className: "starter-background starter-background--room",
      },
    },
    sprites: {
      mio_smile: {
        src: "/assets/images/mio_smile.svg",
        label: "美緒",
        alt: "笑顔の美緒",
        className: "starter-character starter-character--mio",
      },
      sora_normal: {
        src: "/assets/images/sora_normal.svg",
        label: "空",
        alt: "空",
        className: "starter-character starter-character--sora",
      },
    },
  },
  audio: {
    // bgm_main: "/assets/audio/bgm_main.mp3",
    // click: "/assets/audio/click.mp3",
    // mio_001: "/assets/audio/mio_001.mp3",
    bgm: {},
    se: {},
    voice: {},
  },
} as const satisfies TsuzuruGameAssets;
