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

  return (
    <div className="visual-layer" aria-label="std-visual placeholder layer">
      <div
        key={background === null ? "empty" : background.assetId}
        className={joinClassNames(
          "visual-layer__background",
          background === null ? "visual-layer__background--empty" : undefined,
        )}
      >
        {background === null ? null : <span>{background.assetId}</span>}
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

  return (
    <div
      className={joinClassNames("visual-layer__sprite", `visual-layer__sprite--${position}`, presentation.className)}
      style={presentation.style}
    >
      <span>{assetId}</span>
      <small>{position}</small>
    </div>
  );
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
