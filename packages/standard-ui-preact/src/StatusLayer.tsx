import type { ComponentChildren } from "preact";
import { joinClassNames } from "./class-name.js";

export interface StatusLayerProps {
  readonly label: string;
  readonly buttonLabel?: string;
  readonly onButtonClick?: () => void;
  readonly className?: string;
}

export function StatusLayer({ label, buttonLabel, onButtonClick, className }: StatusLayerProps): ComponentChildren {
  const shouldShowButton = buttonLabel !== undefined && onButtonClick !== undefined;

  return (
    <div className={joinClassNames("tzr-status-layer", className)}>
      <div className="tzr-status-layer__label">{label}</div>
      {shouldShowButton ? (
        <button className="tzr-status-layer__button" type="button" onClick={onButtonClick}>
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}
