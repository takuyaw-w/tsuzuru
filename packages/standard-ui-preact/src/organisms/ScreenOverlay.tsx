import type { ComponentChildren } from "preact";
import { joinClassNames } from "../class-name.js";

export interface ScreenOverlayProps {
  readonly children: ComponentChildren;
  readonly className?: string;
}

export function ScreenOverlay({ children, className }: ScreenOverlayProps): ComponentChildren {
  return (
    <div className={joinClassNames("tzr-screen-host", className)}>
      <div className="tzr-screen-host__backdrop" />
      <div className="tzr-screen-host__surface">{children}</div>
    </div>
  );
}
