import type {
  StdVisualBackground,
  StdVisualBackgroundTransition,
  StdVisualDirection,
  StdVisualSprite,
  StdVisualSprites,
  StdVisualTransition,
} from "@tsuzuru/plugin-std-visual";
import type { ComponentChildren, ComponentProps } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { type ResolvedImageAsset, resolveImageAsset, type TsuzuruGameImageAsset } from "./assets.js";
import { joinClassNames } from "./class-name.js";

type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;
type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

export interface StdVisualTransitionOptions {
  readonly enabled?: boolean | undefined;
  readonly animateOnInitialMount?: boolean | undefined;
}

export interface StdVisualLayerProps {
  readonly background?: StdVisualBackground | null | undefined;
  readonly sprites?: StdVisualSprites | undefined;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly spriteAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly transitions?: boolean | StdVisualTransitionOptions | undefined;
  readonly className?: string | undefined;
}

interface ResolvedStdVisualTransitionOptions {
  readonly enabled: boolean;
  readonly animateOnInitialMount: boolean;
}

interface ActiveBackgroundTransition {
  readonly key: number;
  readonly previous?: StdVisualBackground | undefined;
  readonly transition: StdVisualBackgroundTransition;
}

interface TransitionPresentation {
  readonly className?: string | undefined;
  readonly style?: DivStyle | undefined;
}

export function StdVisualLayer({
  background,
  sprites = {},
  backgroundAssets,
  spriteAssets,
  transitions,
  className,
}: StdVisualLayerProps): ComponentChildren {
  const transitionOptions = resolveTransitionOptions(transitions);
  const previousBackgroundRef = useRef<StdVisualBackground | null | undefined>(undefined);
  const backgroundTransitionKeyRef = useRef(0);
  const backgroundTimerRef = useRef<TimeoutHandle | undefined>(undefined);
  const [activeBackgroundTransition, setActiveBackgroundTransition] = useState<ActiveBackgroundTransition | null>(null);
  const previousSpritesRef = useRef<StdVisualSprites | undefined>(undefined);
  const spriteTimersRef = useRef(new Map<string, TimeoutHandle>());
  const [activeSpriteTransitions, setActiveSpriteTransitions] = useState<Readonly<Record<string, StdVisualTransition>>>(
    {},
  );

  useLayoutEffect(() => {
    const previousBackground = previousBackgroundRef.current;
    const nextBackground = background ?? null;
    previousBackgroundRef.current = nextBackground;

    if (backgroundTimerRef.current !== undefined) {
      globalThis.clearTimeout(backgroundTimerRef.current);
      backgroundTimerRef.current = undefined;
    }

    if (!transitionOptions.enabled) {
      setActiveBackgroundTransition(null);
      return;
    }

    const isInitialMount = previousBackground === undefined;
    if (isInitialMount && !transitionOptions.animateOnInitialMount) {
      setActiveBackgroundTransition(null);
      return;
    }

    if (nextBackground === null) {
      setActiveBackgroundTransition(null);
      return;
    }

    const transition = nextBackground.transition;
    if (!isRenderedBackgroundTransition(transition)) {
      setActiveBackgroundTransition(null);
      return;
    }

    if (!isInitialMount && (previousBackground === null || previousBackground.assetId === nextBackground.assetId)) {
      setActiveBackgroundTransition(null);
      return;
    }

    const nextTransitionKey = backgroundTransitionKeyRef.current + 1;
    backgroundTransitionKeyRef.current = nextTransitionKey;
    const nextTransitionState: ActiveBackgroundTransition =
      previousBackground === null || previousBackground === undefined
        ? { key: nextTransitionKey, transition }
        : { key: nextTransitionKey, previous: previousBackground, transition };
    setActiveBackgroundTransition(nextTransitionState);

    backgroundTimerRef.current = globalThis.setTimeout(() => {
      backgroundTimerRef.current = undefined;
      setActiveBackgroundTransition(null);
    }, transition.durationMs);
  }, [background, transitionOptions.animateOnInitialMount, transitionOptions.enabled]);

  useLayoutEffect(() => {
    const previousSprites = previousSpritesRef.current;
    previousSpritesRef.current = sprites;

    if (!transitionOptions.enabled) {
      clearSpriteTransitionTimers(spriteTimersRef.current);
      setActiveSpriteTransitions({});
      return;
    }

    const isInitialMount = previousSprites === undefined;
    if (isInitialMount && !transitionOptions.animateOnInitialMount) {
      return;
    }

    const nextActiveTransitions: Record<string, StdVisualTransition> = {};
    for (const [assetId, sprite] of Object.entries(sprites)) {
      const transition = sprite.transition;
      if (!isRenderedSpriteTransition(transition)) {
        continue;
      }

      const previousSprite = previousSprites?.[assetId];
      if (
        !isInitialMount &&
        previousSprite !== undefined &&
        spriteTransitionSignature(previousSprite) === spriteTransitionSignature(sprite)
      ) {
        continue;
      }

      const existingTimer = spriteTimersRef.current.get(assetId);
      if (existingTimer !== undefined) {
        globalThis.clearTimeout(existingTimer);
      }

      nextActiveTransitions[assetId] = transition;
      const timer = globalThis.setTimeout(() => {
        spriteTimersRef.current.delete(assetId);
        setActiveSpriteTransitions((current) => {
          if (current[assetId] === undefined) {
            return current;
          }
          const { [assetId]: _expired, ...remainingTransitions } = current;
          return remainingTransitions;
        });
      }, transition.durationMs);
      spriteTimersRef.current.set(assetId, timer);
    }

    if (Object.keys(nextActiveTransitions).length > 0) {
      setActiveSpriteTransitions((current) => ({ ...current, ...nextActiveTransitions }));
    }
  }, [sprites, transitionOptions.animateOnInitialMount, transitionOptions.enabled]);

  useLayoutEffect(
    () => () => {
      if (backgroundTimerRef.current !== undefined) {
        globalThis.clearTimeout(backgroundTimerRef.current);
      }
      clearSpriteTransitionTimers(spriteTimersRef.current);
    },
    [],
  );

  return (
    <div className={joinClassNames("tzr-tsuzuru-game__visual-layer", className)} aria-hidden="true">
      {activeBackgroundTransition?.previous === undefined
        ? null
        : renderBackground({
            key: `previous-${activeBackgroundTransition.key}`,
            background: activeBackgroundTransition.previous,
            backgroundAssets,
            presentation: toBackgroundTransitionPresentation(activeBackgroundTransition.transition, "outgoing"),
            extraClassName: "tzr-tsuzuru-game__background--previous",
          })}
      {background === null || background === undefined ? (
        <div className="tzr-tsuzuru-game__background tzr-tsuzuru-game__background--empty" />
      ) : (
        renderBackground({
          key: activeBackgroundTransition === null ? background.assetId : `current-${activeBackgroundTransition.key}`,
          background,
          backgroundAssets,
          presentation:
            activeBackgroundTransition === null
              ? undefined
              : toBackgroundTransitionPresentation(activeBackgroundTransition.transition, "incoming"),
          extraClassName: "tzr-tsuzuru-game__background--current",
        })
      )}
      <div className="tzr-tsuzuru-game__sprite-layer">
        {Object.entries(sprites).map(([assetId, sprite]) => {
          const spriteTransition = activeSpriteTransitions[assetId];
          const presentation =
            spriteTransition === undefined ? undefined : toSpriteTransitionPresentation(spriteTransition);
          return renderImageAsset({
            key: assetId,
            assetId,
            asset: resolveImageAsset(spriteAssets, assetId),
            baseClassName: joinClassNames(
              "tzr-tsuzuru-game__sprite",
              `tzr-tsuzuru-game__sprite--${sprite.position}`,
              presentation?.className,
            ),
            placeholderClassName: "tzr-tsuzuru-game__sprite-placeholder",
            style: presentation?.style,
          });
        })}
      </div>
    </div>
  );
}

function renderBackground({
  key,
  background,
  backgroundAssets,
  presentation,
  extraClassName,
}: {
  readonly key: string;
  readonly background: StdVisualBackground;
  readonly backgroundAssets?: Readonly<Record<string, TsuzuruGameImageAsset>> | undefined;
  readonly presentation?: TransitionPresentation | undefined;
  readonly extraClassName: string;
}): ComponentChildren {
  return renderImageAsset({
    key,
    assetId: background.assetId,
    asset: resolveImageAsset(backgroundAssets, background.assetId),
    baseClassName: joinClassNames("tzr-tsuzuru-game__background", extraClassName, presentation?.className),
    placeholderClassName: "tzr-tsuzuru-game__background-placeholder",
    style: presentation?.style,
  });
}

function renderImageAsset({
  key,
  assetId,
  asset,
  baseClassName,
  placeholderClassName,
  style,
}: {
  readonly key?: string;
  readonly assetId: string;
  readonly asset: ResolvedImageAsset;
  readonly baseClassName: string;
  readonly placeholderClassName: string;
  readonly style?: DivStyle | undefined;
}): ComponentChildren {
  if (asset.src !== undefined) {
    return (
      <img
        key={key}
        className={joinClassNames(baseClassName, asset.className)}
        src={asset.src}
        alt={asset.alt}
        draggable={false}
        style={style}
      />
    );
  }

  return (
    <div
      key={key}
      className={joinClassNames(baseClassName, placeholderClassName, asset.className)}
      aria-label={assetId}
      style={style}
    >
      <span className="tzr-tsuzuru-game__asset-label">{asset.label}</span>
    </div>
  );
}

function resolveTransitionOptions(
  transitions: boolean | StdVisualTransitionOptions | undefined,
): ResolvedStdVisualTransitionOptions {
  if (transitions === false) {
    return { enabled: false, animateOnInitialMount: false };
  }
  if (transitions === true || transitions === undefined) {
    return { enabled: true, animateOnInitialMount: false };
  }
  return {
    enabled: transitions.enabled ?? true,
    animateOnInitialMount: transitions.animateOnInitialMount ?? false,
  };
}

function toBackgroundTransitionPresentation(
  transition: StdVisualBackgroundTransition,
  phase: "incoming" | "outgoing",
): TransitionPresentation {
  return {
    className: joinClassNames(
      `tzr-tsuzuru-game__background--transition-${transition.effect}`,
      `tzr-tsuzuru-game__background--transition-${phase}`,
      transition.direction === undefined
        ? undefined
        : `tzr-tsuzuru-game__background--direction-${transition.direction}`,
    ),
    style: {
      "--tzr-visual-transition-duration": `${transition.durationMs}ms`,
      "--tzr-visual-transition-color": transition.color ?? "transparent",
      ...backgroundDirectionStyle(transition.direction),
    } as DivStyle,
  };
}

function toSpriteTransitionPresentation(transition: StdVisualTransition): TransitionPresentation {
  return {
    className: `tzr-tsuzuru-game__sprite--transition-${transition.type}`,
    style: {
      "--tzr-visual-transition-duration": `${transition.durationMs}ms`,
    } as DivStyle,
  };
}

function backgroundDirectionStyle(direction: StdVisualDirection | undefined): DivStyle {
  switch (direction) {
    case "left":
      return {
        "--tzr-visual-transition-slide-x": "-100%",
        "--tzr-visual-transition-slide-y": "0",
        "--tzr-visual-transition-turn-origin": "left center",
      } as DivStyle;
    case "right":
      return {
        "--tzr-visual-transition-slide-x": "100%",
        "--tzr-visual-transition-slide-y": "0",
        "--tzr-visual-transition-turn-origin": "right center",
      } as DivStyle;
    case "up":
      return {
        "--tzr-visual-transition-slide-x": "0",
        "--tzr-visual-transition-slide-y": "-100%",
        "--tzr-visual-transition-turn-origin": "center top",
      } as DivStyle;
    case "down":
      return {
        "--tzr-visual-transition-slide-x": "0",
        "--tzr-visual-transition-slide-y": "100%",
        "--tzr-visual-transition-turn-origin": "center bottom",
      } as DivStyle;
    case undefined:
      return {};
  }
}

function isRenderedBackgroundTransition(
  transition: StdVisualBackgroundTransition | undefined,
): transition is StdVisualBackgroundTransition {
  return transition !== undefined && transition.effect !== "cut" && transition.durationMs > 0;
}

function isRenderedSpriteTransition(transition: StdVisualTransition | undefined): transition is StdVisualTransition {
  return (
    transition !== undefined &&
    transition.durationMs > 0 &&
    (transition.type === "fade" || transition.type === "dissolve")
  );
}

function spriteTransitionSignature(sprite: StdVisualSprite): string {
  const transition = sprite.transition;
  return transition === undefined ? "" : `${transition.type}:${transition.durationMs}`;
}

function clearSpriteTransitionTimers(timers: Map<string, TimeoutHandle>): void {
  for (const timer of timers.values()) {
    globalThis.clearTimeout(timer);
  }
  timers.clear();
}
