import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "../class-name.js";

type DivStyle = Extract<NonNullable<ComponentProps<"div">["style"]>, object>;

export interface GameViewportFrameProps {
  readonly aspectRatio: string;
  readonly maxWidth?: string;
  readonly className?: string;
  readonly style?: DivStyle;
  readonly children: ComponentChildren;
}

export function GameViewportFrame({
  aspectRatio,
  maxWidth,
  className,
  style,
  children,
}: GameViewportFrameProps): ComponentChildren {
  return (
    <div
      className={joinClassNames("tzr-game-viewport", className)}
      style={{
        ...style,
        aspectRatio,
        maxWidth,
      }}
    >
      <div className="tzr-game-viewport__inner">{children}</div>
    </div>
  );
}
