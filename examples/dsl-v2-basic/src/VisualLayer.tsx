import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState, type StdVisualSpritePosition, type StdVisualTransition } from "@tsuzuru/plugin-std-visual";
import type { ComponentProps } from "preact";

type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

interface VisualLayerProps {
  readonly runtimeState: RuntimeState;
}

export function VisualLayer({ runtimeState }: VisualLayerProps) {
  const visualState = getStdVisualState(runtimeState);
  const background = visualState.background;
  const sprites = Object.entries(visualState.sprites);
  const backgroundTransition = toTransitionPresentation("visual-layer__background", background?.transition);
  const backgroundPresentation = background === null ? null : getBackgroundPresentation(background.assetId);

  return (
    <div className="visual-layer" aria-label="std-visual placeholder layer">
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
            <span className="visual-layer__scene-sun" />
            <span className="visual-layer__scene-platform" />
            <span className="visual-layer__scene-rail visual-layer__scene-rail--front" />
            <span className="visual-layer__scene-rail visual-layer__scene-rail--back" />
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
}

type SpritePresentation = AssetPresentation;

function getBackgroundPresentation(assetId: string): AssetPresentation {
  if (assetId === "station") {
    return {
      className: "visual-layer__background--station",
      label: "STATION",
    };
  }
  return {
    className: "visual-layer__background--generic",
    label: assetId,
  };
}

function getSpritePresentation(assetId: string): SpritePresentation {
  if (assetId === "mio_smile") {
    return {
      className: "visual-layer__sprite--mio-smile",
      label: "美緒",
    };
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
