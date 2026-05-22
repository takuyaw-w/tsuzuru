import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState } from "@tsuzuru/plugin-std-visual";
import type { ComponentChildren } from "preact";
import type { TsuzuruGameImageAsset } from "./assets.js";
import { StdVisualLayer } from "./std-visual-layer.js";

export interface StdVisualRuntimeLayerProps {
  readonly runtimeState: RuntimeState;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly spriteAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly className?: string | undefined;
}

export function StdVisualRuntimeLayer({
  runtimeState,
  backgroundAssets,
  spriteAssets,
  className,
}: StdVisualRuntimeLayerProps): ComponentChildren {
  const visualState = getStdVisualState(runtimeState);

  return (
    <StdVisualLayer
      background={visualState.background}
      sprites={visualState.sprites}
      backgroundAssets={backgroundAssets}
      spriteAssets={spriteAssets}
      className={className}
    />
  );
}
