import type { RuntimeEvent, RuntimeValue } from "@tsuzuru/core";
import type { ComponentChildren } from "preact";
import { ChoiceLayer } from "./ChoiceLayer.js";
import { NovelTextWindow, type NovelTextWindowRenderLine } from "./NovelTextWindow.js";
import { StatusLayer } from "./StatusLayer.js";

export type RuntimeNovelTextSpeakerMode = "hidden" | "inline" | "block";

export interface RuntimeNovelTextLayerProps {
  readonly event: RuntimeEvent;
  readonly onChoice?: (itemIndex: number) => void;
  readonly onAdvance?: () => void;
  readonly onContinue?: () => void;
  readonly renderMessageLine?: NovelTextWindowRenderLine;
  readonly canAdvance?: boolean;
  readonly showTransientStatus?: boolean;
  readonly advanceHint?: string;
  readonly continueLabel?: string;
  readonly speakerMode?: RuntimeNovelTextSpeakerMode;
  readonly className?: string;
}

type TextRuntimeEvent = Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }>;

export function RuntimeNovelTextLayer({
  event,
  onChoice,
  onAdvance,
  onContinue,
  renderMessageLine,
  canAdvance,
  showTransientStatus = false,
  advanceHint,
  continueLabel = "Continue",
  speakerMode = "inline",
  className,
}: RuntimeNovelTextLayerProps): ComponentChildren {
  switch (event.type) {
    case "narration":
    case "dialogue":
      return (
        <NovelTextWindow
          lines={getRuntimeNovelTextLines(event, speakerMode)}
          {...(renderMessageLine !== undefined ? { renderLine: renderMessageLine } : {})}
          {...(onAdvance !== undefined ? { onAdvance } : {})}
          {...(canAdvance !== undefined ? { canAdvance } : {})}
          {...(advanceHint !== undefined ? { advanceHint } : {})}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "choice":
      return (
        <ChoiceLayer
          question={event.question}
          choices={event.items.map((item) => ({ text: item.text }))}
          {...(onChoice !== undefined ? { onChoice } : {})}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "waitClick":
      return (
        <StatusLayer
          label="Waiting for click"
          buttonLabel={continueLabel}
          {...(onContinue !== undefined ? { onButtonClick: onContinue } : {})}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "page":
      return (
        <StatusLayer
          label="Page break"
          buttonLabel={continueLabel}
          {...(onContinue !== undefined ? { onButtonClick: onContinue } : {})}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "wait":
      return (
        <StatusLayer label={`Waiting ${event.durationMs}ms`} {...(className !== undefined ? { className } : {})} />
      );
    case "error":
      return <StatusLayer label={event.message} {...(className !== undefined ? { className } : {})} />;
    case "unsupported":
      return (
        <StatusLayer
          label={`Unsupported instruction: ${event.instructionType}`}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "stop":
      return <StatusLayer label="Stopped" {...(className !== undefined ? { className } : {})} />;
    case "end":
      return <StatusLayer label="End" {...(className !== undefined ? { className } : {})} />;
    case "scene":
    case "jump":
    case "choiceResolve":
    case "if":
    case "state":
    case "pluginCommand":
      return showTransientStatus ? (
        <StatusLayer label={formatTransientEvent(event)} {...(className !== undefined ? { className } : {})} />
      ) : null;
  }
}

export function getRuntimeNovelTextLines(
  event: TextRuntimeEvent,
  speakerMode: RuntimeNovelTextSpeakerMode = "inline",
): readonly string[] {
  const lines = event.lines.map((line) => line.text);
  if (event.type === "narration" || speakerMode === "hidden") {
    return lines;
  }

  if (speakerMode === "block") {
    return [`【${event.speaker}】`, ...lines];
  }

  if (lines.length === 0) {
    return [`${event.speaker}「」`];
  }
  if (lines.length === 1) {
    return [`${event.speaker}「${lines[0]}」`];
  }

  const [firstLine, ...remainingLines] = lines;
  const lastIndex = remainingLines.length - 1;
  return [
    `${event.speaker}「${firstLine}`,
    ...remainingLines.map((line, index) => (index === lastIndex ? `${line}」` : line)),
  ];
}

type TransientRuntimeEvent = Extract<
  RuntimeEvent,
  { readonly type: "scene" | "jump" | "choiceResolve" | "if" | "state" | "pluginCommand" }
>;

function formatTransientEvent(event: TransientRuntimeEvent): string {
  switch (event.type) {
    case "scene":
      return `Scene: ${event.id}`;
    case "jump":
      return `Jump scene: ${event.sceneId}`;
    case "choiceResolve":
      return `Choice: ${event.text}`;
    case "if":
      return `If: ${String(event.result)} (${event.branch})`;
    case "state":
      return `${event.command}: ${event.name} = ${formatRuntimeValue(event.value)}`;
    case "pluginCommand":
      return `Plugin command: ${event.name}`;
  }
}

function formatRuntimeValue(value: RuntimeValue): string {
  return typeof value === "string" ? value : String(value);
}
