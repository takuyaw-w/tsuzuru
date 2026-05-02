import type { ComponentChildren } from "preact";
import { joinClassNames } from "./class-name.js";

export interface GameShellProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function GameShell({ children, className }: GameShellProps): ComponentChildren {
  return <div className={joinClassNames("tzr-game-shell", className)}>{children}</div>;
}
