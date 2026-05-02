import { useState } from "preact/hooks";
import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState, type StdVisualSpritePosition } from "@tsuzuru/plugin-std-visual";
import { backgroundAssets, spriteAssets } from "./assets.js";

interface VisualLayerProps {
  readonly runtimeState: RuntimeState;
}

interface SpriteRenderItem {
  readonly assetId: string;
  readonly position: StdVisualSpritePosition;
  readonly path: string | null;
}

export function VisualLayer({ runtimeState }: VisualLayerProps) {
  const visualState = getStdVisualState(runtimeState);
  const backgroundAssetId = visualState.background?.assetId;
  const backgroundPath = backgroundAssetId === undefined ? null : resolveBackgroundPath(backgroundAssetId);
  const sprites = createSpriteRenderItems(visualState.sprites);

  return (
    <div className="visual-layer" aria-label="std-visual layer">
      {backgroundAssetId === undefined ? (
        <FallbackBox className="visual-layer__empty" label="No background" />
      ) : backgroundPath === null ? (
        <MissingAsset kind="background" assetId={backgroundAssetId} />
      ) : (
        <AssetImage className="visual-layer__background" src={backgroundPath} fallbackLabel={`Missing background: ${backgroundAssetId}`} />
      )}
      <div className="visual-layer__sprites" aria-label="sprites">
        {sprites.map((sprite) =>
          sprite.path === null ? (
            <MissingAsset key={sprite.assetId} kind="sprite" assetId={sprite.assetId} position={sprite.position} />
          ) : (
            <AssetImage
              key={sprite.assetId}
              className={`visual-layer__sprite visual-layer__sprite--${sprite.position}`}
              src={sprite.path}
              fallbackLabel={`Missing sprite: ${sprite.assetId}`}
            />
          ),
        )}
      </div>
    </div>
  );
}

function createSpriteRenderItems(
  sprites: ReturnType<typeof getStdVisualState>["sprites"],
): readonly SpriteRenderItem[] {
  return Object.entries(sprites).map(([assetId, sprite]) => ({
    assetId,
    position: sprite.position,
    path: resolveSpritePath(assetId),
  }));
}

interface AssetImageProps {
  readonly className: string;
  readonly src: string;
  readonly fallbackLabel: string;
}

function AssetImage({ className, src, fallbackLabel }: AssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <FallbackBox className={`${className} visual-layer__missing`} label={fallbackLabel} />;
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={() => {
        console.warn(`[standard-ui-preact example] Image could not be loaded: ${src}`);
        setFailed(true);
      }}
    />
  );
}

function resolveBackgroundPath(assetId: string): string | null {
  if (isBackgroundAssetId(assetId)) {
    return backgroundAssets[assetId];
  }

  console.warn(`[standard-ui-preact example] Missing background asset mapping: ${assetId}`);
  return null;
}

function resolveSpritePath(assetId: string): string | null {
  if (isSpriteAssetId(assetId)) {
    return spriteAssets[assetId];
  }

  console.warn(`[standard-ui-preact example] Missing sprite asset mapping: ${assetId}`);
  return null;
}

function isBackgroundAssetId(assetId: string): assetId is keyof typeof backgroundAssets {
  return Object.hasOwn(backgroundAssets, assetId);
}

function isSpriteAssetId(assetId: string): assetId is keyof typeof spriteAssets {
  return Object.hasOwn(spriteAssets, assetId);
}

interface MissingAssetProps {
  readonly kind: "background" | "sprite";
  readonly assetId: string;
  readonly position?: StdVisualSpritePosition;
}

function MissingAsset({ kind, assetId, position }: MissingAssetProps) {
  const positionClassName = position === undefined ? "" : ` visual-layer__missing--${position}`;
  return (
    <FallbackBox
      className={`visual-layer__missing visual-layer__missing--${kind}${positionClassName}`}
      label={`Missing ${kind}: ${assetId}`}
    />
  );
}

function FallbackBox({ className, label }: { readonly className: string; readonly label: string }) {
  return <div className={className}>{label}</div>;
}
