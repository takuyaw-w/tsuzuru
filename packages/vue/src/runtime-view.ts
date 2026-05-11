import type { RuntimeEvent } from "@tsuzuru/core";
import { defineComponent, h, type PropType, type VNodeChild } from "vue";

export interface RuntimeViewProps {
  readonly event: RuntimeEvent;
  readonly onChoice?: (itemIndex: number) => void;
  readonly onContinue?: () => void;
  readonly onAdvance?: () => void;
  readonly canAdvance?: boolean;
}

export const RuntimeView = defineComponent({
  name: "RuntimeView",
  props: {
    event: {
      type: Object as PropType<RuntimeEvent>,
      required: true,
    },
    canAdvance: {
      type: Boolean,
      default: true,
    },
  },
  emits: {
    choice: (_itemIndex: number) => true,
    continue: () => true,
    advance: () => true,
  },
  setup(props, { emit }) {
    return () =>
      renderRuntimeEvent({
        event: props.event,
        canAdvance: props.canAdvance,
        onChoice: (itemIndex) => emit("choice", itemIndex),
        onContinue: () => emit("continue"),
        onAdvance: () => emit("advance"),
      });
  },
});

export const TsuzuruRuntimeView = RuntimeView;

function renderRuntimeEvent({
  event,
  onChoice,
  onContinue,
  onAdvance,
  canAdvance = true,
}: RuntimeViewProps): VNodeChild {
  switch (event.type) {
    case "narration":
      return renderAdvanceableMessage(
        "tzr-runtime-view--narration",
        event.lines.map((line) => h("p", line.text)),
        onAdvance,
        canAdvance,
      );
    case "dialogue":
      return renderAdvanceableMessage(
        "tzr-runtime-view--dialogue",
        [
          h("p", { class: "tzr-runtime-view__speaker" }, event.speaker),
          ...event.lines.map((line) => h("p", line.text)),
        ],
        onAdvance,
        canAdvance,
      );
    case "choice":
      return h("section", { class: "tzr-runtime-view tzr-runtime-view--choice" }, [
        h("p", { class: "tzr-runtime-view__question" }, event.question),
        h(
          "ol",
          { class: "tzr-runtime-view__choices" },
          event.items.map((item, index) =>
            h("li", [h("button", { type: "button", onClick: () => onChoice?.(index) }, item.text)]),
          ),
        ),
      ]);
    case "waitClick":
      return renderControlMessage("Waiting for click", "Continue", onContinue);
    case "page":
      return renderControlMessage("Page break", "Continue", onContinue);
    case "wait":
      return renderStatusMessage(`Waiting ${event.durationMs}ms`);
    case "scene":
      return renderStatusMessage(`Scene: ${event.id}`);
    case "pluginCommand":
      return renderStatusMessage(`Plugin command: ${event.name}`);
    case "unsupported":
      return renderStatusMessage(`Unsupported instruction: ${event.instructionType}`);
    case "error":
      return renderStatusMessage(event.message);
    case "end":
      return renderStatusMessage("End");
    case "stop":
      return renderStatusMessage("Stopped");
    case "state":
      return renderStatusMessage(`${event.command}: ${event.name} = ${String(event.value)}`);
    case "jump":
      return renderStatusMessage(`Jump scene: ${event.sceneId}`);
    case "choiceResolve":
      return renderStatusMessage(`Choice: ${event.text}`);
    case "if":
      return renderStatusMessage(`If: ${event.result ? "true" : "false"} (${event.branch})`);
    default:
      return assertNever(event);
  }
}

function renderAdvanceableMessage(
  className: string,
  children: VNodeChild,
  onAdvance: (() => void) | undefined,
  canAdvance: boolean,
): VNodeChild {
  const isAdvanceable = onAdvance !== undefined && canAdvance;
  return h(
    "section",
    {
      class: `tzr-runtime-view ${className}${isAdvanceable ? " tzr-runtime-view--advanceable" : ""}`,
      onClick: isAdvanceable ? onAdvance : undefined,
    },
    [children, isAdvanceable ? h("p", { class: "tzr-runtime-view__advance-hint" }, "Click to continue") : null],
  );
}

function renderStatusMessage(label: string): VNodeChild {
  return h("p", { class: "tzr-runtime-view tzr-runtime-view--status" }, label);
}

function renderControlMessage(label: string, buttonLabel: string, onContinue: (() => void) | undefined): VNodeChild {
  return h("section", { class: "tzr-runtime-view tzr-runtime-view--control" }, [
    h("p", label),
    h("button", { type: "button", onClick: onContinue }, buttonLabel),
  ]);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled runtime event: ${JSON.stringify(value)}`);
}
