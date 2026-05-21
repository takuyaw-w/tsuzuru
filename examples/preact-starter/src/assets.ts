import type { TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

export const assets = {
  visual: {
    backgrounds: {
      classroom: {
        label: "教室",
        className: "starter-background starter-background--classroom",
      },
      station: {
        label: "駅前",
        className: "starter-background starter-background--station",
      },
      room: {
        label: "部屋",
        className: "starter-background starter-background--room",
      },
    },
    sprites: {
      mio_smile: {
        label: "美緒",
        className: "starter-character starter-character--mio",
      },
      sora_normal: {
        label: "空",
        className: "starter-character starter-character--sora",
      },
    },
  },
  audio: {
    bgm: {},
    se: {},
    voice: {},
  },
} as const satisfies TsuzuruGameAssets;
