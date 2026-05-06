import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";

type DivProps = ComponentProps<"div">;
type AdvanceableDivProps = Pick<DivProps, "onClick" | "onKeyDown" | "role" | "tabIndex">;
type DivKeyDownHandler = NonNullable<DivProps["onKeyDown"]>;

export interface MessageWindowRenderLineContext {
  readonly line: string;
  readonly lineIndex: number;
}

export type MessageWindowRenderLine = (context: MessageWindowRenderLineContext) => ComponentChildren;

export interface MessageWindowProps {
  readonly speaker?: string;
  readonly lines: readonly string[];
  readonly renderLine?: MessageWindowRenderLine;
  readonly onAdvance?: () => void;
  readonly canAdvance?: boolean;
  readonly advanceHint?: string;
  readonly className?: string;
}

export function MessageWindow({
  speaker,
  lines,
  renderLine,
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
  let advanceProps: AdvanceableDivProps = {};
  if (canAdvance && onAdvance !== undefined) {
    const advance = onAdvance;
    const handleKeyDown: DivKeyDownHandler = (event) => {
      if (event.key === "Enter") {
        advance();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        advance();
      }
    };
    advanceProps = { onClick: advance, onKeyDown: handleKeyDown, role: "button", tabIndex: 0 };
  }

  return (
    <div className={windowClassName} {...advanceProps}>
      {speaker !== undefined ? <div className="tzr-message-window__speaker">{speaker}</div> : null}
      <div className="tzr-message-window__lines">
        {lines.map((line, index) => (
          <p className="tzr-message-window__line" key={index}>
            {renderLine === undefined ? line : renderLine({ line, lineIndex: index })}
          </p>
        ))}
      </div>
      {isAdvanceable ? <div className="tzr-message-window__advance-hint">{advanceHint}</div> : null}
    </div>
  );
}
