import type { ComponentChildren } from "preact";

export interface SpeakerLabelProps {
  readonly children: ComponentChildren;
}

export function SpeakerLabel({ children }: SpeakerLabelProps): ComponentChildren {
  return (
    <div className="tzr-message-window__speaker" aria-label="Speaker">
      {children}
    </div>
  );
}
