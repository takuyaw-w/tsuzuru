import type { TsuzuruHtmlAssetsManifest } from "@tsuzuru/html";

export const assets = {
  version: 1,
  baseUrl: "/assets/",
  visual: {
    backgrounds: {
      room: {
        src: "images/backgrounds/room.svg",
        alt: "Evening classroom",
      },
    },
    sprites: {
      mio_smile: {
        src: "images/sprites/mio-smile.svg",
        alt: "美緒",
      },
    },
  },
  audio: {
    bgm: {
      daily_theme: {
        src: "audio/bgm/daily-theme.mp3",
      },
    },
    se: {
      page: {
        src: "audio/se/page.mp3",
      },
    },
    voice: {
      mio_001: {
        src: "audio/voice/mio-001.mp3",
      },
    },
  },
} satisfies TsuzuruHtmlAssetsManifest;
