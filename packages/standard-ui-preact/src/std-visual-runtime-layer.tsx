import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState } from "@tsuzuru/plugin-std-visual";
import type { ComponentChildren } from "preact";
import type { TsuzuruGameImageAsset } from "./assets.js";
import type { StdVisualTransitionOptions } from "./std-visual-layer.js";
import { StdVisualLayer } from "./std-visual-layer.js";

export interface StdVisualRuntimeLayerProps {
  readonly runtimeState: RuntimeState;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly spriteAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly transitions?: boolean | StdVisualTransitionOptions | undefined;
  readonly className?: string | undefined;
}

export function StdVisualRuntimeLayer({
  runtimeState,
  backgroundAssets,
  spriteAssets,
  transitions,
  className,
}: StdVisualRuntimeLayerProps): ComponentChildren {
  const visualState = getStdVisualState(runtimeState);

  return (
    <StdVisualLayer
      background={visualState.background}
      sprites={visualState.sprites}
      backgroundAssets={backgroundAssets}
      spriteAssets={spriteAssets}
      transitions={transitions}
      className={className}
    />
  );
}
