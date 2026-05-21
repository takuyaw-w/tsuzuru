import type { RuntimeState } from "@tsuzuru/core";
import { getStdCameraState, type StdCameraEasing } from "@tsuzuru/plugin-std-camera";
import { getStdVisualState, type StdVisualSpritePosition, type StdVisualTransition } from "@tsuzuru/plugin-std-visual";
import type { ComponentProps } from "preact";
import { assets } from "../assets.js";

type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

interface VisualLayerProps {
  readonly runtimeState: RuntimeState;
}

export function VisualLayer({ runtimeState }: VisualLayerProps) {
  const visualState = getStdVisualState(runtimeState);
  const cameraState = getStdCameraState(runtimeState);
  const background = visualState.background;
  const sprites = Object.entries(visualState.sprites);
  const backgroundTransition = toTransitionPresentation("visual-layer__background", background?.transition);
  const backgroundPresentation = background === null ? null : getBackgroundPresentation(background.assetId);
  const cameraPresentation = toCameraPresentation(cameraState, visualState.sprites);

  return (
    <div className="visual-layer" aria-label="std-visual placeholder layer">
      <div className="visual-layer__camera" style={cameraPresentation.style}>
        <div
          key={background === null ? "empty" : transitionKey(background.assetId, background.transition)}
          className={joinClassNames(
            "visual-layer__background",
            background === null ? "visual-layer__background--empty" : undefined,
            backgroundPresentation?.className,
            backgroundTransition.className,
          )}
          style={backgroundTransition.style}
        >
          {background === null || backgroundPresentation === null ? null : (
            <div className="visual-layer__scene" aria-label={background.assetId}>
              {backgroundPresentation.src === undefined ? null : (
                <img className="visual-layer__scene-image" src={backgroundPresentation.src} alt="" aria-hidden="true" />
              )}
              {backgroundPresentation.src !== undefined ? null : (
                <>
                  <span className="visual-layer__scene-sun" />
                  <span className="visual-layer__scene-platform" />
                  <span className="visual-layer__scene-rail visual-layer__scene-rail--front" />
                  <span className="visual-layer__scene-rail visual-layer__scene-rail--back" />
                </>
              )}
              <span className="visual-layer__scene-sign">{backgroundPresentation.label}</span>
            </div>
          )}
        </div>
        <div className="visual-layer__sprites" aria-label="sprites">
          {sprites.map(([assetId, sprite]) => (
            <SpritePlaceholder
              key={transitionKey(assetId, sprite.transition)}
              assetId={assetId}
              position={sprite.position}
              {...(sprite.transition === undefined ? {} : { transition: sprite.transition })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SpritePlaceholder({
  assetId,
  position,
  transition,
}: {
  readonly assetId: string;
  readonly position: StdVisualSpritePosition;
  readonly transition?: StdVisualTransition;
}) {
  const presentation = toTransitionPresentation("visual-layer__sprite", transition);
  const spritePresentation = getSpritePresentation(assetId);

  return (
    <div
      className={joinClassNames(
        "visual-layer__sprite",
        `visual-layer__sprite--${position}`,
        spritePresentation.className,
        presentation.className,
      )}
      style={presentation.style}
      aria-label={assetId}
    >
      <span className="visual-layer__sprite-head" />
      <span className="visual-layer__sprite-body" />
      <span className="visual-layer__sprite-name">{spritePresentation.label}</span>
    </div>
  );
}

interface AssetPresentation {
  readonly className: string;
  readonly label: string;
  readonly src?: string;
}

type SpritePresentation = AssetPresentation;

function getBackgroundPresentation(assetId: string): AssetPresentation {
  const presentation = assets.visual.backgrounds[assetId as keyof typeof assets.visual.backgrounds];
  if (presentation !== undefined) {
    return presentation;
  }
  return {
    className: "visual-layer__background--generic",
    label: assetId,
  };
}

function getSpritePresentation(assetId: string): SpritePresentation {
  const presentation = assets.visual.sprites[assetId as keyof typeof assets.visual.sprites];
  if (presentation !== undefined) {
    return presentation;
  }
  return {
    className: "visual-layer__sprite--generic",
    label: assetId,
  };
}

interface TransitionPresentation {
  readonly className?: string;
  readonly style?: DivStyle;
}

interface CameraPresentation {
  readonly style: DivStyle;
}

function toCameraPresentation(
  camera: ReturnType<typeof getStdCameraState>,
  sprites: ReturnType<typeof getStdVisualState>["sprites"],
): CameraPresentation {
  const focusOffsetX = camera.focusTarget === null ? 0 : cameraFocusOffsetX(sprites[camera.focusTarget]?.position);
  const transition = camera.transition;

  return {
    style: {
      "--tzr-camera-x": `${camera.x + focusOffsetX}px`,
      "--tzr-camera-y": `${camera.y}px`,
      "--tzr-camera-zoom": String(camera.zoom),
      "--tzr-camera-duration": transition === null ? "0ms" : `${transition.durationMs}ms`,
      "--tzr-camera-easing": transition === null ? "ease" : toCssCameraEasing(transition.easing),
    } as DivStyle,
  };
}

function cameraFocusOffsetX(position: StdVisualSpritePosition | undefined): number {
  switch (position) {
    case "left":
      return 160;
    case "right":
      return -160;
    case "center":
    case undefined:
      return 0;
  }
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

function toTransitionPresentation(
  baseClassName: string,
  transition: StdVisualTransition | undefined,
): TransitionPresentation {
  if (transition === undefined || !isRenderedTransitionType(transition.type)) {
    return {};
  }

  return {
    className: `${baseClassName}--transition-${transition.type}`,
    style: {
      "--tzr-visual-transition-duration": `${transition.durationMs}ms`,
    } as DivStyle,
  };
}

function transitionKey(assetId: string, transition: StdVisualTransition | undefined): string {
  if (transition === undefined) {
    return assetId;
  }
  return `${assetId}:${transition.type}:${transition.durationMs}`;
}

function isRenderedTransitionType(type: string): type is "fade" | "dissolve" {
  return type === "fade" || type === "dissolve";
}

function joinClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className) => className !== undefined && className.length > 0).join(" ");
}
