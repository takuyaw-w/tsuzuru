import type { StdCameraEasing, StdCameraState } from "@tsuzuru/plugin-std-camera";
import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";

type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

export interface StdCameraOffset {
  readonly x?: number | undefined;
  readonly y?: number | undefined;
}

export interface StdCameraLayerProps {
  readonly cameraState: StdCameraState;
  readonly focusOffset?: StdCameraOffset | undefined;
  readonly className?: string | undefined;
  readonly children: ComponentChildren;
}

export function StdCameraLayer({
  cameraState,
  focusOffset,
  className,
  children,
}: StdCameraLayerProps): ComponentChildren {
  const transition = cameraState.transition;

  return (
    <div className={joinClassNames("tzr-std-camera-layer", className)} aria-hidden="true">
      <div
        className="tzr-std-camera-layer__inner"
        style={
          {
            "--tzr-camera-x": `${cameraState.x + (focusOffset?.x ?? 0)}px`,
            "--tzr-camera-y": `${cameraState.y + (focusOffset?.y ?? 0)}px`,
            "--tzr-camera-zoom": String(cameraState.zoom),
            "--tzr-camera-duration": transition === null ? "0ms" : `${transition.durationMs}ms`,
            "--tzr-camera-easing": transition === null ? "ease" : toCssCameraEasing(transition.easing),
          } as DivStyle
        }
      >
        {children}
      </div>
    </div>
  );
}

function toCssCameraEasing(easing: StdCameraEasing): string {
  switch (easing) {
    case "linear":
      return "linear";
    case "easeIn":
      return "ease-in";
    case "easeOut":
      return "ease-out";
    case "ease":
      return "ease";
  }
}
