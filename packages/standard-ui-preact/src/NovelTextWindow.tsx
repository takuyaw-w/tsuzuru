import type { ComponentChildren, ComponentProps } from "preact";
import { Panel } from "./atoms/Panel.js";
import { joinClassNames } from "./class-name.js";

type DivProps = ComponentProps<"div">;
type AdvanceableDivProps = Pick<DivProps, "onClick" | "onKeyDown" | "role" | "tabIndex">;
type DivKeyDownHandler = NonNullable<DivProps["onKeyDown"]>;

export interface NovelTextWindowRenderLineContext {
  readonly line: string;
  readonly lineIndex: number;
}

export type NovelTextWindowRenderLine = (context: NovelTextWindowRenderLineContext) => ComponentChildren;

export interface NovelTextWindowProps {
  readonly lines: readonly string[];
  readonly renderLine?: NovelTextWindowRenderLine;
  readonly onAdvance?: () => void;
  readonly canAdvance?: boolean;
  readonly advanceHint?: string;
  readonly className?: string;
}

export function NovelTextWindow({
  lines,
  renderLine,
  onAdvance,
  canAdvance = false,
  advanceHint = "Click to continue",
  className,
}: NovelTextWindowProps): ComponentChildren {
  const isAdvanceable = canAdvance && onAdvance !== undefined;
  const windowClassName = joinClassNames(
    "tzr-novel-text-window",
    isAdvanceable ? "tzr-novel-text-window--advanceable" : undefined,
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
      <div className="tzr-novel-text-window__body" key="body">
        {lines.map((line, index) => (
          <p className="tzr-novel-text-window__line" key={index}>
            {renderLine === undefined ? line : renderLine({ line, lineIndex: index })}
          </p>
        ))}
      </div>,
      isAdvanceable ? (
        <div className="tzr-novel-text-window__advance" key="advance">
          {advanceHint}
        </div>
      ) : null,
    ],
  });
}
