import type { RuntimeState } from "@tsuzuru/core";
import { getStdCameraState } from "@tsuzuru/plugin-std-camera";
import type { StdVisualState } from "@tsuzuru/plugin-std-visual";
import type { ComponentChildren } from "preact";
import { StdCameraLayer, type StdCameraOffset } from "./std-camera-layer.js";

export type StdCameraFocusOffsetResolver = (
  focusTarget: string,
  context: {
    readonly visualState?: StdVisualState | undefined;
  },
) => StdCameraOffset;

export interface StdCameraRuntimeLayerProps {
  readonly runtimeState: RuntimeState;
  readonly visualState?: StdVisualState | undefined;
  readonly resolveFocusOffset?: StdCameraFocusOffsetResolver | undefined;
  readonly className?: string | undefined;
  readonly children: ComponentChildren;
}

export function StdCameraRuntimeLayer({
  runtimeState,
  visualState,
  resolveFocusOffset,
  className,
  children,
}: StdCameraRuntimeLayerProps): ComponentChildren {
  const cameraState = getStdCameraState(runtimeState);
  const focusOffset =
    cameraState.focusTarget === null || resolveFocusOffset === undefined
      ? undefined
      : resolveFocusOffset(cameraState.focusTarget, { visualState });

  return (
    <StdCameraLayer cameraState={cameraState} focusOffset={focusOffset} className={className}>
      {children}
    </StdCameraLayer>
  );
}
