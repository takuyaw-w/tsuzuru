import type { ComponentChildren } from "preact";
import { StandardButton } from "../atoms/Button.js";
import type { ChoiceLayerItem } from "../ChoiceLayer.js";

export interface ChoiceListProps {
  readonly choices: readonly ChoiceLayerItem[];
  readonly onChoice?: (itemIndex: number) => void;
}

export function ChoiceList({ choices, onChoice }: ChoiceListProps): ComponentChildren {
  return (
    <ol className="tzr-choice-layer__list">
      {choices.map((choice, index) => (
        <li className="tzr-choice-layer__item" key={index}>
          {StandardButton({
            className: "tzr-choice-layer__button",
            onClick: () => onChoice?.(index),
            children: choice.text,
          })}
        </li>
      ))}
    </ol>
  );
}
