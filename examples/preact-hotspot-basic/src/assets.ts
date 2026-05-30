import type { TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

export const assets = {
  visual: {
    backgrounds: {
      study_room: {
        src: "/assets/images/detective-office.svg",
        label: "古い書斎",
        className: "hotspot-background hotspot-background--study-room",
      },
    },
    sprites: {},
  },
} as const satisfies TsuzuruGameAssets;
