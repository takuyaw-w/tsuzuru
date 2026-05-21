import type { ComponentChildren } from "preact";
import { MessageLine } from "../atoms/MessageLine.js";
import type { MessageWindowRenderLine } from "../MessageWindow.js";

export interface MessageLinesProps {
  readonly lines: readonly string[];
  readonly renderLine?: MessageWindowRenderLine;
}

export function MessageLines({ lines, renderLine }: MessageLinesProps): ComponentChildren {
  return (
    <div className="tzr-message-window__lines">
      {lines.map((line, index) =>
        MessageLine({
          lineKey: index,
          children: renderLine === undefined ? line : renderLine({ line, lineIndex: index }),
        }),
      )}
    </div>
  );
}
