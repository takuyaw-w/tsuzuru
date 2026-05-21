import type { ComponentChildren } from "preact";
import { GameShellFrame } from "./layouts/GameShellFrame.js";

export interface GameShellProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function GameShell({ children, className }: GameShellProps): ComponentChildren {
  return GameShellFrame({ children, ...(className === undefined ? {} : { className }) });
}
