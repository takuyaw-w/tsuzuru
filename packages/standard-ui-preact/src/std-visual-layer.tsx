import type { StdVisualBackground, StdVisualSprites } from "@tsuzuru/plugin-std-visual";
import type { ComponentChildren } from "preact";
import { type ResolvedImageAsset, resolveImageAsset, type TsuzuruGameImageAsset } from "./assets.js";
import { joinClassNames } from "./class-name.js";

export interface StdVisualLayerProps {
  readonly background?: StdVisualBackground | null | undefined;
  readonly sprites?: StdVisualSprites | undefined;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly spriteAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly className?: string | undefined;
}

export function StdVisualLayer({
  background,
  sprites = {},
  backgroundAssets,
  spriteAssets,
  className,
}: StdVisualLayerProps): ComponentChildren {
  return (
    <div className={joinClassNames("tzr-tsuzuru-game__visual-layer", className)} aria-hidden="true">
      {background === null || background === undefined ? (
        <div className="tzr-tsuzuru-game__background tzr-tsuzuru-game__background--empty" />
      ) : (
        renderImageAsset({
          assetId: background.assetId,
          asset: resolveImageAsset(backgroundAssets, background.assetId),
          baseClassName: "tzr-tsuzuru-game__background",
          placeholderClassName: "tzr-tsuzuru-game__background-placeholder",
        })
      )}
      <div className="tzr-tsuzuru-game__sprite-layer">
        {Object.entries(sprites).map(([assetId, sprite]) =>
          renderImageAsset({
            key: assetId,
            assetId,
            asset: resolveImageAsset(spriteAssets, assetId),
            baseClassName: joinClassNames("tzr-tsuzuru-game__sprite", `tzr-tsuzuru-game__sprite--${sprite.position}`),
            placeholderClassName: "tzr-tsuzuru-game__sprite-placeholder",
          }),
        )}
      </div>
    </div>
  );
}

function renderImageAsset({
  key,
  assetId,
  asset,
  baseClassName,
  placeholderClassName,
}: {
  readonly key?: string;
  readonly assetId: string;
  readonly asset: ResolvedImageAsset;
  readonly baseClassName: string;
  readonly placeholderClassName: string;
}): ComponentChildren {
  if (asset.src !== undefined) {
    return (
      <img
        key={key}
        className={joinClassNames(baseClassName, asset.className)}
        src={asset.src}
        alt={asset.alt}
        draggable={false}
      />
    );
  }

  return (
    <div
      key={key}
      className={joinClassNames(baseClassName, placeholderClassName, asset.className)}
      aria-label={assetId}
    >
      <span className="tzr-tsuzuru-game__asset-label">{asset.label}</span>
    </div>
  );
}
