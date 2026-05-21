import type { ComponentChildren } from "preact";
import { StandardButton } from "../atoms/Button.js";

export interface StatusPanelProps {
  readonly label: string;
  readonly buttonLabel?: string;
  readonly onButtonClick?: () => void;
}

export function StatusPanel({ label, buttonLabel, onButtonClick }: StatusPanelProps): ComponentChildren {
  const shouldShowButton = buttonLabel !== undefined && onButtonClick !== undefined;

  return (
    <>
      <div className="tzr-status-layer__label">{label}</div>
      {shouldShowButton
        ? StandardButton({ className: "tzr-status-layer__button", onClick: onButtonClick, children: buttonLabel })
        : null}
    </>
  );
}
