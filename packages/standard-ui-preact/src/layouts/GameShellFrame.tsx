import type { ComponentChildren } from "preact";
import { joinClassNames } from "../class-name.js";

export interface GameShellFrameProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function GameShellFrame({ children, className }: GameShellFrameProps): ComponentChildren {
  return <div className={joinClassNames("tzr-game-shell", className)}>{children}</div>;
}
