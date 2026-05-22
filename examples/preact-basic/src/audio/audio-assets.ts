import type { TsuzuruGameAudioAsset } from "@tsuzuru/standard-ui-preact";

type AudioAssetMap = Readonly<Record<string, string>>;

export function createAudioAssetsWithVolume(
  assets: AudioAssetMap,
  volume: number,
): Readonly<Record<string, TsuzuruGameAudioAsset>> {
  return Object.fromEntries(Object.entries(assets).map(([assetId, src]) => [assetId, { src, volume }]));
}
