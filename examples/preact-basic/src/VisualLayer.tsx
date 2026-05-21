import type { RuntimeState } from "@tsuzuru/core";
import { getStdCameraState, type StdCameraEasing } from "@tsuzuru/plugin-std-camera";
import {
  getStdVisualState,
  type StdVisualBackground,
  type StdVisualBackgroundTransition,
  type StdVisualDirection,
  type StdVisualSpritePosition,
  type StdVisualTransition,
} from "@tsuzuru/plugin-std-visual";
import type { ComponentProps } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { assets } from "../assets.js";

type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

interface VisualLayerProps {
  readonly runtimeState: RuntimeState;
  readonly backgroundAnimationSuppression: BackgroundAnimationSuppression;
}

interface BackgroundAnimationSuppression {
  readonly key: number;
  readonly assetId: string | null;
}

export function VisualLayer({ runtimeState, backgroundAnimationSuppression }: VisualLayerProps) {
  const visualState = getStdVisualState(runtimeState);
  const cameraState = getStdCameraState(runtimeState);
  const background = visualState.background;
  const backgroundAnimation = useBackgroundAnimation(background, backgroundAnimationSuppression);
  const sprites = Object.entries(visualState.sprites);
  const cameraPresentation = toCameraPresentation(cameraState, visualState.sprites);

  return (
    <div className="visual-layer" aria-label="std-visual placeholder layer">
      <div className="visual-layer__camera" style={cameraPresentation.style}>
        <BackgroundLayer background={background} layerRole="current" animation={backgroundAnimation} />
        {backgroundAnimation.previous === null ? null : (
          <BackgroundLayer
            key={backgroundAnimation.key}
            background={backgroundAnimation.previous}
            layerRole="previous"
            animation={backgroundAnimation}
          />
        )}
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

interface BackgroundAnimationState {
  readonly key: number;
  readonly previous: StdVisualBackground | null;
  readonly transition?: StdVisualBackgroundTransition;
}

function useBackgroundAnimation(
  background: StdVisualBackground | null,
  suppression: BackgroundAnimationSuppression,
): BackgroundAnimationState {
  const previousBackground = useRef<StdVisualBackground | null>(background);
  const consumedSuppressionKey = useRef(suppression.key);
  const timeoutRef = useRef<number | undefined>(undefined);
  const animationKey = useRef(0);
  const [animation, setAnimation] = useState<BackgroundAnimationState>({ key: 0, previous: null });

  useLayoutEffect(() => {
    const shouldSuppressAnimation =
      consumedSuppressionKey.current !== suppression.key && background?.assetId === suppression.assetId;
    const previous = previousBackground.current;
    previousBackground.current = background;

    if (timeoutRef.current !== undefined) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    if (
      shouldSuppressAnimation ||
      previous === null ||
      background === null ||
      previous.assetId === background.assetId ||
      !isRenderedBackgroundTransition(background.transition)
    ) {
      if (shouldSuppressAnimation) {
        consumedSuppressionKey.current = suppression.key;
      }
      setAnimation({ key: animationKey.current, previous: null });
      return;
    }

    const key = animationKey.current + 1;
    animationKey.current = key;
    setAnimation({ key, previous, transition: background.transition });
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = undefined;
      setAnimation({ key, previous: null });
    }, background.transition.durationMs);

    return () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, [background, suppression]);

  return animation;
}

function BackgroundLayer({
  background,
  layerRole,
  animation,
}: {
  readonly background: StdVisualBackground | null;
  readonly layerRole: "current" | "previous";
  readonly animation: BackgroundAnimationState;
}) {
  const backgroundPresentation = background === null ? null : getBackgroundPresentation(background.assetId);
  const transitionPresentation =
    layerRole === "current"
      ? toBackgroundTransitionPresentation("visual-layer__background", animation.transition, "incoming")
      : toBackgroundTransitionPresentation("visual-layer__background", animation.transition, "outgoing");

  return (
    <div
      className={joinClassNames(
        "visual-layer__background",
        `visual-layer__background--${layerRole}`,
        background === null ? "visual-layer__background--empty" : undefined,
        backgroundPresentation?.className,
        transitionPresentation.className,
      )}
      style={transitionPresentation.style}
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

function toBackgroundTransitionPresentation(
  baseClassName: string,
  transition: StdVisualBackgroundTransition | undefined,
  phase: "incoming" | "outgoing",
): TransitionPresentation {
  if (!isRenderedBackgroundTransition(transition)) {
    return {};
  }

  return {
    className: joinClassNames(
      `${baseClassName}--transition-${transition.effect}`,
      `${baseClassName}--transition-${phase}`,
      transition.direction === undefined ? undefined : `${baseClassName}--direction-${transition.direction}`,
    ),
    style: {
      "--tzr-visual-transition-duration": `${transition.durationMs}ms`,
      "--tzr-bg-transition-color": transition.color ?? "transparent",
      ...backgroundDirectionStyle(transition.direction),
    } as DivStyle,
  };
}

function transitionKey(assetId: string, transition: StdVisualTransition | undefined): string {
  if (transition === undefined) {
    return assetId;
  }
  return `${assetId}:${transition.type}:${transition.durationMs}`;
}

function isRenderedBackgroundTransition(
  transition: StdVisualBackgroundTransition | undefined,
): transition is StdVisualBackgroundTransition {
  return transition !== undefined && transition.effect !== "cut" && transition.durationMs > 0;
}

function isRenderedTransitionType(type: string): type is "fade" | "dissolve" {
  return type === "fade" || type === "dissolve";
}

function backgroundDirectionStyle(direction: StdVisualDirection | undefined): DivStyle {
  switch (direction) {
    case "left":
      return {
        "--tzr-bg-slide-x": "-100%",
        "--tzr-bg-slide-y": "0",
        "--tzr-bg-turn-origin": "left center",
      } as DivStyle;
    case "right":
      return {
        "--tzr-bg-slide-x": "100%",
        "--tzr-bg-slide-y": "0",
        "--tzr-bg-turn-origin": "right center",
      } as DivStyle;
    case "up":
      return { "--tzr-bg-slide-x": "0", "--tzr-bg-slide-y": "-100%", "--tzr-bg-turn-origin": "center top" } as DivStyle;
    case "down":
      return {
        "--tzr-bg-slide-x": "0",
        "--tzr-bg-slide-y": "100%",
        "--tzr-bg-turn-origin": "center bottom",
      } as DivStyle;
    case undefined:
      return {};
  }
}

function joinClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className) => className !== undefined && className.length > 0).join(" ");
}
