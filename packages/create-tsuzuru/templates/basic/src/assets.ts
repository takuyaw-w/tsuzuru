import type { TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

// Add your own files under public/assets/images and map them here.
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
    },
    sprites: {
      mio_smile: {
        src: "/assets/images/mio_smile.svg",
        label: "美緒",
        alt: "笑顔の美緒",
        className: "starter-character",
      },
    },
  },
  audio: {
    bgm: {},
    se: {},
    voice: {},
  },
} as const satisfies TsuzuruGameAssets;
