import type { ComponentChildren, JSX } from "preact";
import { joinClassNames } from "./class-name.js";

export interface MessageWindowProps {
  readonly speaker?: string;
  readonly lines: readonly string[];
  readonly onAdvance?: () => void;
  readonly canAdvance?: boolean;
  readonly advanceHint?: string;
  readonly className?: string;
}

export function MessageWindow({
  speaker,
  lines,
  onAdvance,
  canAdvance = false,
  advanceHint = "Click to continue",
  className,
}: MessageWindowProps): ComponentChildren {
  const isAdvanceable = canAdvance && onAdvance !== undefined;
  const windowClassName = joinClassNames(
    "tzr-message-window",
    speaker === undefined ? "tzr-message-window--narration" : "tzr-message-window--dialogue",
    isAdvanceable ? "tzr-message-window--advanceable" : undefined,
    className,
  );
  const clickProps: Pick<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "role" | "tabIndex"> = isAdvanceable
    ? { onClick: onAdvance, role: "button", tabIndex: 0 }
    : {};

  return (
    <div className={windowClassName} {...clickProps}>
      {speaker !== undefined ? <div className="tzr-message-window__speaker">{speaker}</div> : null}
      <div className="tzr-message-window__lines">
        {lines.map((line, index) => (
          <p className="tzr-message-window__line" key={index}>
            {line}
          </p>
        ))}
      </div>
      {isAdvanceable ? <div className="tzr-message-window__advance-hint">{advanceHint}</div> : null}
    </div>
  );
}
