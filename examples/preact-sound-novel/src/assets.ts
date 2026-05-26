import type { TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

export const assets = {
  visual: {
    backgrounds: {
      rain_room: {
        label: "Rain Room",
        className: "sound-novel-bg sound-novel-bg--rain-room",
      },
      dawn_station: {
        label: "Dawn Station",
        className: "sound-novel-bg sound-novel-bg--dawn-station",
      },
    },
  },
  audio: {
    bgm: {},
    se: {},
    voice: {},
  },
} as const satisfies TsuzuruGameAssets;
