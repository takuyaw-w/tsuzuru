import type { ComponentChildren } from "preact";
import { Panel } from "./atoms/Panel.js";
import { joinClassNames } from "./class-name.js";
import { StatusPanel } from "./molecules/StatusPanel.js";

export interface StatusLayerProps {
  readonly label: string;
  readonly buttonLabel?: string;
  readonly onButtonClick?: () => void;
  readonly className?: string;
}

export function StatusLayer({ label, buttonLabel, onButtonClick, className }: StatusLayerProps): ComponentChildren {
  return Panel({
    className: joinClassNames("tzr-status-layer", className),
    children: StatusPanel({
      label,
      ...(buttonLabel === undefined ? {} : { buttonLabel }),
      ...(onButtonClick === undefined ? {} : { onButtonClick }),
    }),
  });
}
