import type { ComponentChildren, JSX } from "preact";
import { joinClassNames } from "./class-name.js";

export type GameViewportAspectRatio = "16:9" | "4:3";

export type GameViewportProps = {
  readonly aspectRatio?: GameViewportAspectRatio;
  readonly maxWidth?: number | string;
  readonly className?: string;
  readonly style?: JSX.CSSProperties;
  readonly children: ComponentChildren;
};

export function GameViewport({
  aspectRatio = "16:9",
  maxWidth,
  className,
  style,
  children,
}: GameViewportProps): ComponentChildren {
  const resolvedMaxWidth = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  return (
    <div
      className={joinClassNames("tzr-game-viewport", className)}
      style={{
        ...style,
        aspectRatio,
        maxWidth: resolvedMaxWidth,
      }}
    >
      <div className="tzr-game-viewport__inner">{children}</div>
    </div>
  );
}
