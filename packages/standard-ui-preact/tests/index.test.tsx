import type { RuntimeEvent } from "@tsuzuru/core";
import { isValidElement, type ComponentChildren, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import {
  ChoiceLayer,
  GameShell,
  MessageWindow,
  RuntimeMessageLayer,
  StatusLayer,
  type ChoiceLayerProps,
  type MessageWindowProps,
  type StatusLayerProps,
} from "../src/index.js";

interface TestNodeProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
  readonly onClick?: () => void;
  readonly role?: string;
  readonly tabIndex?: number;
}

const loc = {
  start: { filePath: "scenario/main.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/main.tzr", line: 1, column: 1 },
};

function expectVNode<P = TestNodeProps>(value: ComponentChildren): VNode<P> {
  expect(isValidElement(value)).toBe(true);
  if (!isValidElement(value)) {
    throw new Error("expected VNode");
  }
  return value as VNode<P>;
}

function getNodeText(value: ComponentChildren): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((child) => getNodeText(child)).join("");
  }
  if (isValidElement(value)) {
    return getNodeText((value as VNode<TestNodeProps>).props.children);
  }
  return "";
}

function findByClass(value: ComponentChildren, className: string): readonly VNode<TestNodeProps>[] {
  if (value === null || value === undefined || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child) => findByClass(child, className));
  }
  if (!isValidElement(value)) {
    return [];
  }

  const vnode = value as VNode<TestNodeProps>;
  const matches = vnode.props.className?.split(" ").includes(className) === true ? [vnode] : [];
  return [...matches, ...findByClass(vnode.props.children, className)];
}

describe("GameShell", () => {
  it("renders children", () => {
    const node = expectVNode(GameShell({ children: "story", className: "custom-shell" }));

    expect(node.props.className).toBe("tzr-game-shell custom-shell");
    expect(getNodeText(node)).toBe("story");
  });
});

describe("MessageWindow", () => {
  it("renders narration without speaker", () => {
    const node = expectVNode(MessageWindow({ lines: ["It was raining."] }));

    expect(node.props.className).toContain("tzr-message-window--narration");
    expect(findByClass(node, "tzr-message-window__speaker")).toHaveLength(0);
    expect(getNodeText(node)).toContain("It was raining.");
  });

  it("renders dialogue with speaker", () => {
    const node = expectVNode(MessageWindow({ speaker: "Haruka", lines: ["You're late."] }));

    expect(node.props.className).toContain("tzr-message-window--dialogue");
    expect(getNodeText(node)).toContain("Haruka");
    expect(getNodeText(node)).toContain("You're late.");
  });

  it("calls onAdvance when advanceable", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(MessageWindow({ lines: ["Next."], onAdvance, canAdvance: true }));

    node.props.onClick?.();

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(node.props.className).toContain("tzr-message-window--advanceable");
    expect(getNodeText(node)).toContain("Click to continue");
  });

  it("does not call onAdvance when canAdvance=false", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(MessageWindow({ lines: ["Wait."], onAdvance, canAdvance: false }));

    node.props.onClick?.();

    expect(onAdvance).not.toHaveBeenCalled();
    expect(node.props.onClick).toBeUndefined();
    expect(getNodeText(node)).not.toContain("Click to continue");
  });
});

describe("ChoiceLayer", () => {
  it("renders question and choices", () => {
    const node = expectVNode(
      ChoiceLayer({
        question: "What do you do?",
        choices: [{ text: "Apologize" }, { text: "Make a joke" }],
      }),
    );

    expect(getNodeText(node)).toContain("What do you do?");
    expect(getNodeText(node)).toContain("Apologize");
    expect(getNodeText(node)).toContain("Make a joke");
  });

  it("calls onChoice with index", () => {
    const onChoice = vi.fn();
    const node = expectVNode(
      ChoiceLayer({
        question: "Where?",
        choices: [{ text: "Stay" }, { text: "Go" }],
        onChoice,
      }),
    );
    const buttons = findByClass(node, "tzr-choice-layer__button");

    buttons[1]?.props.onClick?.();

    expect(onChoice).toHaveBeenCalledWith(1);
  });
});

describe("StatusLayer", () => {
  it("renders label", () => {
    const node = expectVNode(StatusLayer({ label: "Stopped" }));

    expect(getNodeText(node)).toContain("Stopped");
  });

  it("renders button only when buttonLabel and onButtonClick are both provided", () => {
    const onButtonClick = vi.fn();
    const withButton = expectVNode(StatusLayer({ label: "Page break", buttonLabel: "Continue", onButtonClick }));
    const withoutLabel = expectVNode(StatusLayer({ label: "Page break", onButtonClick }));
    const withoutHandler = expectVNode(StatusLayer({ label: "Page break", buttonLabel: "Continue" }));

    expect(findByClass(withButton, "tzr-status-layer__button")).toHaveLength(1);
    expect(findByClass(withoutLabel, "tzr-status-layer__button")).toHaveLength(0);
    expect(findByClass(withoutHandler, "tzr-status-layer__button")).toHaveLength(0);

    findByClass(withButton, "tzr-status-layer__button")[0]?.props.onClick?.();
    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });
});

describe("RuntimeMessageLayer", () => {
  it("maps narration", () => {
    const node = expectVNode<MessageWindowProps>(
      RuntimeMessageLayer({
        event: { type: "narration", lines: [{ text: "The room was quiet.", loc }] },
        onAdvance: vi.fn(),
        canAdvance: true,
      }),
    );

    expect(node.type).toBe(MessageWindow);
    expect(node.props.lines).toEqual(["The room was quiet."]);
    expect(node.props.speaker).toBeUndefined();
  });

  it("maps dialogue", () => {
    const node = expectVNode<MessageWindowProps>(
      RuntimeMessageLayer({
        event: { type: "dialogue", speaker: "Yu", lines: [{ text: "I made it.", loc }] },
      }),
    );

    expect(node.type).toBe(MessageWindow);
    expect(node.props.speaker).toBe("Yu");
    expect(node.props.lines).toEqual(["I made it."]);
  });

  it("maps choice", () => {
    const onChoice = vi.fn();
    const node = expectVNode<ChoiceLayerProps>(
      RuntimeMessageLayer({
        event: {
          type: "choice",
          question: "What do you do?",
          items: [
            { text: "Stay", targetRaw: "#stay", targetLabel: "stay" },
            { text: "Go", targetRaw: "#go", targetLabel: "go" },
          ],
        },
        onChoice,
      }),
    );

    expect(node.type).toBe(ChoiceLayer);
    expect(node.props.question).toBe("What do you do?");
    expect(node.props.choices).toEqual([{ text: "Stay" }, { text: "Go" }]);
    expect(node.props.onChoice).toBe(onChoice);
  });

  it("maps waitClick and page", () => {
    const onContinue = vi.fn();
    const waitClick = expectVNode<StatusLayerProps>(
      RuntimeMessageLayer({ event: { type: "waitClick" }, onContinue, continueLabel: "Next" }),
    );
    const page = expectVNode<StatusLayerProps>(RuntimeMessageLayer({ event: { type: "page" }, onContinue }));

    expect(waitClick.type).toBe(StatusLayer);
    expect(waitClick.props.label).toBe("Waiting for click");
    expect(waitClick.props.buttonLabel).toBe("Next");
    expect(waitClick.props.onButtonClick).toBe(onContinue);
    expect(page.props.label).toBe("Page break");
    expect(page.props.buttonLabel).toBe("Continue");
  });

  it("maps error, unsupported, stop, and end", () => {
    const events: readonly [RuntimeEvent, string][] = [
      [{ type: "error", code: "choice_not_pending", message: "Choice is not pending." }, "Choice is not pending."],
      [{ type: "unsupported", instructionType: "MacroInstruction" }, "Unsupported instruction: MacroInstruction"],
      [{ type: "stop" }, "Stopped"],
      [{ type: "end" }, "End"],
    ];

    for (const [event, label] of events) {
      const node = expectVNode<StatusLayerProps>(RuntimeMessageLayer({ event }));
      expect(node.type).toBe(StatusLayer);
      expect(node.props.label).toBe(label);
    }
  });

  it("maps wait", () => {
    const node = expectVNode<StatusLayerProps>(RuntimeMessageLayer({ event: { type: "wait", durationMs: 500 } }));

    expect(node.type).toBe(StatusLayer);
    expect(node.props.label).toBe("Waiting 500ms");
  });

  it("hides transient events by default", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "scene", id: "prologue" },
      { type: "label", id: "start" },
      { type: "jump", label: "after_choice", instructionIndex: 12 },
      { type: "if", result: true, branch: "then" },
      { type: "state", command: "flag", name: "met_haruka", value: true },
      { type: "pluginCommand", name: "bg" },
    ];

    for (const event of events) {
      expect(RuntimeMessageLayer({ event })).toBeNull();
    }
  });

  it("shows transient events when showTransientStatus=true", () => {
    const events: readonly [RuntimeEvent, string][] = [
      [{ type: "scene", id: "prologue" }, "Scene: prologue"],
      [{ type: "label", id: "start" }, "Label: start"],
      [{ type: "jump", label: "after_choice", instructionIndex: 12 }, "Jump: #after_choice"],
      [{ type: "if", result: false, branch: "else" }, "If: false (else)"],
      [{ type: "state", command: "set", name: "route", value: "haruka" }, "set: route = haruka"],
      [{ type: "pluginCommand", name: "bg" }, "Plugin command: bg"],
    ];

    for (const [event, label] of events) {
      const node = expectVNode<StatusLayerProps>(RuntimeMessageLayer({ event, showTransientStatus: true }));
      expect(node.type).toBe(StatusLayer);
      expect(node.props.label).toBe(label);
    }
  });
});
