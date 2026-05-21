import type { ComponentChildren, ComponentProps } from "preact";
import { GameViewportFrame } from "./layouts/GameViewportFrame.js";

export type GameViewportAspectRatio = "16:9" | "4:3";
type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

export type GameViewportProps = {
  readonly aspectRatio?: GameViewportAspectRatio;
  readonly maxWidth?: number | string;
  readonly className?: string;
  readonly style?: DivStyle;
  readonly children: ComponentChildren;
};

export function GameViewport({
  aspectRatio = "16:9",
  maxWidth,
  className,
  style,
  children,
}: GameViewportProps): ComponentChildren {
  const resolvedAspectRatio = resolveAspectRatio(aspectRatio);
  const resolvedMaxWidth = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  return GameViewportFrame({
    aspectRatio: resolvedAspectRatio,
    children,
    ...(resolvedMaxWidth === undefined ? {} : { maxWidth: resolvedMaxWidth }),
    ...(className === undefined ? {} : { className }),
    ...(style === undefined ? {} : { style }),
  });
}

function resolveAspectRatio(aspectRatio: GameViewportAspectRatio): string {
  switch (aspectRatio) {
    case "16:9":
      return "16 / 9";
    case "4:3":
      return "4 / 3";
  }
}
