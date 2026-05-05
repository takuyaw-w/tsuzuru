import type { RuntimeEvent, RuntimeValue } from "@tsuzuru/core";
import type { ComponentChildren } from "preact";
import { ChoiceLayer } from "./ChoiceLayer.js";
import { MessageWindow } from "./MessageWindow.js";
import { StatusLayer } from "./StatusLayer.js";

export interface RuntimeMessageLayerProps {
  readonly event: RuntimeEvent;
  readonly onChoice?: (itemIndex: number) => void;
  readonly onAdvance?: () => void;
  readonly onContinue?: () => void;
  readonly canAdvance?: boolean;
  readonly showTransientStatus?: boolean;
  readonly advanceHint?: string;
  readonly continueLabel?: string;
  readonly className?: string;
}

export function RuntimeMessageLayer({
  event,
  onChoice,
  onAdvance,
  onContinue,
  canAdvance,
  showTransientStatus = false,
  advanceHint,
  continueLabel = "Continue",
  className,
}: RuntimeMessageLayerProps): ComponentChildren {
  switch (event.type) {
    case "narration":
      return (
        <MessageWindow
          lines={event.lines.map((line) => line.text)}
          {...(onAdvance !== undefined ? { onAdvance } : {})}
          {...(canAdvance !== undefined ? { canAdvance } : {})}
          {...(advanceHint !== undefined ? { advanceHint } : {})}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "dialogue":
      return (
        <MessageWindow
          speaker={event.speaker}
          lines={event.lines.map((line) => line.text)}
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
      return <StatusLayer label={`Waiting ${event.durationMs}ms`} {...(className !== undefined ? { className } : {})} />;
    case "error":
      return <StatusLayer label={event.message} {...(className !== undefined ? { className } : {})} />;
    case "unsupported":
      return (
        <StatusLayer label={`Unsupported instruction: ${event.instructionType}`} {...(className !== undefined ? { className } : {})} />
      );
    case "stop":
      return <StatusLayer label="Stopped" {...(className !== undefined ? { className } : {})} />;
    case "end":
      return <StatusLayer label="End" {...(className !== undefined ? { className } : {})} />;
    case "scene":
    case "label":
    case "jump":
    case "if":
    case "state":
    case "pluginCommand":
      return showTransientStatus ? (
        <StatusLayer label={formatTransientEvent(event)} {...(className !== undefined ? { className } : {})} />
      ) : null;
  }
}

type TransientRuntimeEvent = Extract<RuntimeEvent, { readonly type: "scene" | "label" | "jump" | "if" | "state" | "pluginCommand" }>;

function formatTransientEvent(event: TransientRuntimeEvent): string {
  switch (event.type) {
    case "scene":
      return `Scene: ${event.id}`;
    case "label":
      return `Label: ${event.id}`;
    case "jump":
      return "label" in event ? `Jump: #${event.label}` : `Jump scene: ${event.sceneId}`;
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
