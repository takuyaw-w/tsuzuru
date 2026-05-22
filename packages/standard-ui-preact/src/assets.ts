export type TsuzuruGameImageAsset =
  | string
  | {
      readonly src?: string;
      readonly label?: string;
      readonly alt?: string;
      readonly className?: string;
    };

export type TsuzuruGameAudioAsset =
  | string
  | {
      readonly src: string;
      readonly volume?: number;
    };

export interface TsuzuruGameAssets {
  readonly visual?: {
    readonly backgrounds?: Readonly<Record<string, TsuzuruGameImageAsset>>;
    readonly sprites?: Readonly<Record<string, TsuzuruGameImageAsset>>;
  };
  readonly audio?: {
    readonly bgm?: Readonly<Record<string, TsuzuruGameAudioAsset>>;
    readonly se?: Readonly<Record<string, TsuzuruGameAudioAsset>>;
    readonly voice?: Readonly<Record<string, TsuzuruGameAudioAsset>>;
  };
}

export interface ResolvedImageAsset {
  readonly src?: string;
  readonly label: string;
  readonly alt: string;
  readonly className?: string;
}

export interface ResolvedAudioAsset {
  readonly src: string;
  readonly volume?: number;
}

export function resolveImageAsset(
  assets: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined,
  assetId: string,
): ResolvedImageAsset {
  const asset = assets?.[assetId];
  if (asset === undefined) {
    return { label: assetId, alt: assetId };
  }
  if (typeof asset === "string") {
    return { src: asset, label: assetId, alt: "" };
  }
  return {
    ...(asset.src === undefined ? {} : { src: asset.src }),
    label: asset.label ?? assetId,
    alt: asset.alt ?? "",
    ...(asset.className === undefined ? {} : { className: asset.className }),
  };
}

export function resolveAudioAsset(
  assets: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined,
  assetId: string,
): ResolvedAudioAsset | null {
  const asset = assets?.[assetId];
  if (asset === undefined) {
    return null;
  }
  if (typeof asset === "string") {
    return { src: asset };
  }
  return {
    src: asset.src,
    ...(asset.volume === undefined ? {} : { volume: asset.volume }),
  };
}
