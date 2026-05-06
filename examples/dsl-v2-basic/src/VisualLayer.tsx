import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState, type StdVisualSpritePosition } from "@tsuzuru/plugin-std-visual";

interface VisualLayerProps {
  readonly runtimeState: RuntimeState;
}

export function VisualLayer({ runtimeState }: VisualLayerProps) {
  const visualState = getStdVisualState(runtimeState);
  const backgroundAssetId = visualState.background?.assetId ?? null;
  const sprites = Object.entries(visualState.sprites);

  return (
    <div className="visual-layer" aria-label="std-visual placeholder layer">
      <div
        className={`visual-layer__background${backgroundAssetId === null ? " visual-layer__background--empty" : ""}`}
      >
        {backgroundAssetId === null ? null : <span>{backgroundAssetId}</span>}
      </div>
      <div className="visual-layer__sprites" aria-label="sprites">
        {sprites.map(([assetId, sprite]) => (
          <SpritePlaceholder key={assetId} assetId={assetId} position={sprite.position} />
        ))}
      </div>
    </div>
  );
}

function SpritePlaceholder({
  assetId,
  position,
}: {
  readonly assetId: string;
  readonly position: StdVisualSpritePosition;
}) {
  return (
    <div className={`visual-layer__sprite visual-layer__sprite--${position}`}>
      <span>{assetId}</span>
      <small>{position}</small>
    </div>
  );
}
