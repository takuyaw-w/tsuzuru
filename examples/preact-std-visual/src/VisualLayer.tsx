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
  readonly positionIndex: number;
}

export function VisualLayer({ runtimeState }: VisualLayerProps) {
  const visualState = getStdVisualState(runtimeState);
  const backgroundAssetId = visualState.background?.assetId;
  const backgroundPath = backgroundAssetId === undefined ? null : resolveBackgroundPath(backgroundAssetId);
  const sprites = createSpriteRenderItems(visualState.sprites);

  return (
    <div className="visual-layer" aria-label="std-visual layer">
      {backgroundAssetId === undefined ? (
        <div className="visual-layer__empty">No background</div>
      ) : backgroundPath === null ? (
        <MissingAsset kind="background" assetId={backgroundAssetId} />
      ) : (
        <img className="visual-layer__background" src={backgroundPath} alt="" />
      )}
      <div className="visual-layer__sprites" aria-label="sprites">
        {sprites.map((sprite) =>
          sprite.path === null ? (
            <MissingAsset key={sprite.assetId} kind="sprite" assetId={sprite.assetId} />
          ) : (
            <img
              key={sprite.assetId}
              className="visual-layer__sprite"
              src={sprite.path}
              alt=""
              style={spriteStyle(sprite.position, sprite.positionIndex)}
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
  const positionCounts: Record<StdVisualSpritePosition, number> = {
    left: 0,
    center: 0,
    right: 0,
  };

  return Object.entries(sprites).map(([assetId, sprite]) => {
    const positionIndex = positionCounts[sprite.position];
    positionCounts[sprite.position] += 1;
    return {
      assetId,
      position: sprite.position,
      path: resolveSpritePath(assetId),
      positionIndex,
    };
  });
}

function spriteStyle(position: StdVisualSpritePosition, positionIndex: number) {
  const left = position === "left" ? "24%" : position === "center" ? "50%" : "76%";
  const offset = positionIndex * 28;
  return {
    left,
    transform: `translateX(calc(-50% + ${offset}px))`,
  };
}

function resolveBackgroundPath(assetId: string): string | null {
  if (isBackgroundAssetId(assetId)) {
    return backgroundAssets[assetId];
  }

  console.warn(`[preact-std-visual] Missing background asset: ${assetId}`);
  return null;
}

function resolveSpritePath(assetId: string): string | null {
  if (isSpriteAssetId(assetId)) {
    return spriteAssets[assetId];
  }

  console.warn(`[preact-std-visual] Missing sprite asset: ${assetId}`);
  return null;
}

function isBackgroundAssetId(assetId: string): assetId is keyof typeof backgroundAssets {
  return Object.hasOwn(backgroundAssets, assetId);
}

function isSpriteAssetId(assetId: string): assetId is keyof typeof spriteAssets {
  return Object.hasOwn(spriteAssets, assetId);
}

function MissingAsset({ kind, assetId }: { readonly kind: "background" | "sprite"; readonly assetId: string }) {
  return (
    <div className={`visual-layer__missing visual-layer__missing--${kind}`}>
      Missing {kind}: {assetId}
    </div>
  );
}
