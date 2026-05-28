import type { TsuzuruGameAssets } from "@tsuzuru/standard-ui-preact";

export const assets = {
  visual: {
    backgrounds: {
      office: {
        src: "/assets/images/detective-office.svg",
        label: "探偵事務所",
        className: "hotspot-background hotspot-background--office",
      },
    },
    sprites: {},
  },
} as const satisfies TsuzuruGameAssets;
