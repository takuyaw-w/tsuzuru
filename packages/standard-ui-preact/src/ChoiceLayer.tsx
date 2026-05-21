import type { ComponentChildren } from "preact";
import { Panel } from "./atoms/Panel.js";
import { joinClassNames } from "./class-name.js";
import { ChoiceList } from "./molecules/ChoiceList.js";

export interface ChoiceLayerItem {
  readonly text: string;
}

export interface ChoiceLayerProps {
  readonly question: string;
  readonly choices: readonly ChoiceLayerItem[];
  readonly onChoice?: (itemIndex: number) => void;
  readonly className?: string;
}

export function ChoiceLayer({ question, choices, onChoice, className }: ChoiceLayerProps): ComponentChildren {
  return Panel({
    className: joinClassNames("tzr-choice-layer", className),
    children: [
      <div className="tzr-choice-layer__question" key="question">
        {question}
      </div>,
      ChoiceList({ choices, ...(onChoice === undefined ? {} : { onChoice }) }),
    ],
  });
}
