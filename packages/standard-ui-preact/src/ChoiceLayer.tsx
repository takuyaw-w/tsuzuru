import type { ComponentChildren } from "preact";
import { joinClassNames } from "./class-name.js";

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
  return (
    <div className={joinClassNames("tzr-choice-layer", className)}>
      <div className="tzr-choice-layer__question">{question}</div>
      <ol className="tzr-choice-layer__list">
        {choices.map((choice, index) => (
          <li className="tzr-choice-layer__item" key={index}>
            <button className="tzr-choice-layer__button" type="button" onClick={() => onChoice?.(index)}>
              {choice.text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
