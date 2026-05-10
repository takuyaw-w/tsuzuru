import type { TsuzuruHtmlAssetEntry, TsuzuruHtmlAssets } from "@tsuzuru/html";

export interface HtmlBasicGallerySection {
  readonly id: string;
  readonly title: string;
  readonly kind: "visual" | "audio";
  readonly items: readonly HtmlBasicGalleryItem[];
}

export interface HtmlBasicGalleryItem {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
}

export function createHtmlBasicGallerySections(assets: TsuzuruHtmlAssets): readonly HtmlBasicGallerySection[] {
  return [
    {
      id: "backgrounds",
      title: "Backgrounds",
      kind: "visual",
      items: createItems(assets.visual.backgrounds),
    },
    {
      id: "sprites",
      title: "Sprites",
      kind: "visual",
      items: createItems(assets.visual.sprites),
    },
    {
      id: "audio",
      title: "Audio",
      kind: "audio",
      items: [
        ...createItems(assets.audio.bgm),
        ...createItems(assets.audio.se),
        ...createItems(assets.audio.voice),
      ],
    },
  ];
}

function createItems(entries: Readonly<Record<string, TsuzuruHtmlAssetEntry>>): readonly HtmlBasicGalleryItem[] {
  return Object.entries(entries).map(([id, entry]) => ({
    id,
    src: entry.src,
    alt: entry.alt ?? id,
  }));
}
