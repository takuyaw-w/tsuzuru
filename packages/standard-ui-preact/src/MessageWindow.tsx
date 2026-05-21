import type { ComponentChildren, ComponentProps } from "preact";
import { AdvanceHint } from "./atoms/AdvanceHint.js";
import { Panel } from "./atoms/Panel.js";
import { SpeakerLabel } from "./atoms/SpeakerLabel.js";
import { joinClassNames } from "./class-name.js";
import { MessageLines } from "./molecules/MessageLines.js";

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

  return Panel({
    className: windowClassName,
    ...advanceProps,
    children: [
      speaker !== undefined ? SpeakerLabel({ children: speaker }) : null,
      MessageLines({ lines, ...(renderLine === undefined ? {} : { renderLine }) }),
      isAdvanceable ? AdvanceHint({ children: advanceHint }) : null,
    ],
  });
}
