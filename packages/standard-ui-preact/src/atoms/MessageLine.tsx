import type { ComponentChildren } from "preact";

export interface MessageLineProps {
  readonly children: ComponentChildren;
  readonly lineKey?: number;
}

export function MessageLine({ children, lineKey }: MessageLineProps): ComponentChildren {
  return (
    <p className="tzr-message-window__line" key={lineKey}>
      {children}
    </p>
  );
}
