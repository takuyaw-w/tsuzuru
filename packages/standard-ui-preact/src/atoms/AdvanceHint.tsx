import type { ComponentChildren } from "preact";

export interface AdvanceHintProps {
  readonly children: ComponentChildren;
}

export function AdvanceHint({ children }: AdvanceHintProps): ComponentChildren {
  return <div className="tzr-message-window__advance-hint">{children}</div>;
}
