import type { RuntimeEvent } from "@tsuzuru/core";
import { isValidElement, type ComponentChildren, type ComponentProps, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import {
  ChoiceLayer,
  GameViewport,
  GameShell,
  MessageWindow,
  RuntimeMessageLayer,
  ScreenHost,
  StatusLayer,
  type ChoiceLayerProps,
  type GameViewportProps,
  type MessageWindowProps,
  type ScreenComponentProps,
  type ScreenHostProps,
  type StatusLayerProps,
} from "../src/index.js";

type DivProps = ComponentProps<"div">;
type DivClickHandler = NonNullable<DivProps["onClick"]>;
type DivKeyDownHandler = NonNullable<DivProps["onKeyDown"]>;
type TestNodeProps = Pick<DivProps, "children" | "className" | "onClick" | "onKeyDown" | "role" | "style" | "tabIndex">;

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
  const matches = String(vnode.props.className ?? "").split(" ").includes(className) ? [vnode] : [];
  return [...matches, ...findByClass(vnode.props.children, className)];
}

function createDivClickEvent(): Parameters<DivClickHandler>[0] {
  return {} as unknown as Parameters<DivClickHandler>[0];
}

function createDivKeyDownEvent(key: string) {
  const preventDefault = vi.fn();
  const event = { key, preventDefault } as unknown as Parameters<DivKeyDownHandler>[0];
  return { event, preventDefault };
}

describe("GameShell", () => {
  it("renders children", () => {
    const node = expectVNode(GameShell({ children: "story", className: "custom-shell" }));

    expect(node.props.className).toBe("tzr-game-shell custom-shell");
    expect(getNodeText(node)).toBe("story");
  });
});

describe("GameViewport", () => {
  it("renders children in the viewport inner layer", () => {
    const node = expectVNode<GameViewportProps>(GameViewport({ children: "story", className: "custom-viewport" }));
    const inner = findByClass(node, "tzr-game-viewport__inner");

    expect(node.props.className).toBe("tzr-game-viewport custom-viewport");
    expect(node.props.style).toMatchObject({ aspectRatio: "16 / 9" });
    expect(inner).toHaveLength(1);
    expect(getNodeText(inner[0])).toBe("story");
  });

  it("resolves aspectRatio and numeric maxWidth", () => {
    const node = expectVNode<GameViewportProps>(GameViewport({ children: "story", aspectRatio: "4:3", maxWidth: 960 }));

    expect(node.props.style).toMatchObject({ aspectRatio: "4 / 3", maxWidth: "960px" });
  });

  it("passes string maxWidth through and gives calculated styles priority", () => {
    const node = expectVNode<GameViewportProps>(
      GameViewport({
        children: "story",
        maxWidth: "80vw",
        style: { aspectRatio: "1 / 1", maxWidth: "100%" },
      }),
    );

    expect(node.props.style).toMatchObject({ aspectRatio: "16 / 9", maxWidth: "80vw" });
  });
});

describe("ScreenHost", () => {
  it("returns null when activeScreen is null", () => {
    expect(ScreenHost({ activeScreen: null, screens: {}, onClose: vi.fn() })).toBeNull();
  });

  it("renders a registered screen", () => {
    const NotebookScreen = (props: ScreenComponentProps): ComponentChildren => (
      <div className="test-screen">{String((props.params as { title?: string } | undefined)?.title ?? "Untitled")}</div>
    );
    const node = expectVNode<ScreenHostProps>(
      ScreenHost({
        activeScreen: { id: "notebook", params: { title: "Notebook" } },
        screens: { notebook: NotebookScreen },
        onClose: vi.fn(),
      }),
    );
    const surface = findByClass(node, "tzr-screen-host__surface")[0];
    const screenNode = expectVNode<ScreenComponentProps>(surface?.props.children);

    expect(node.props.className).toBe("tzr-screen-host");
    expect(screenNode.type).toBe(NotebookScreen);
  });

  it("passes params and onClose to the screen component", () => {
    const onClose = vi.fn();
    const params = { page: 2 };
    const NotebookScreen = (_props: ScreenComponentProps): ComponentChildren => <div />;
    const node = expectVNode(
      ScreenHost({
        activeScreen: { id: "notebook", params },
        screens: { notebook: NotebookScreen },
        onClose,
      }),
    );
    const surface = findByClass(node, "tzr-screen-host__surface")[0];
    const screenNode = expectVNode<ScreenComponentProps>(surface?.props.children);

    expect(screenNode.props.params).toBe(params);
    expect(screenNode.props.onClose).toBe(onClose);
  });

  it("renders fallback UI for unknown screen id", () => {
    const node = expectVNode(
      ScreenHost({
        activeScreen: { id: "missing" },
        screens: {},
        onClose: vi.fn(),
      }),
    );
    const surface = findByClass(node, "tzr-screen-host__surface")[0];
    const fallbackNode = expectVNode<{ readonly screenId: string; readonly onClose: () => void }>(surface?.props.children);
    const renderedFallback = expectVNode(
      (fallbackNode.type as (props: typeof fallbackNode.props) => ComponentChildren)(fallbackNode.props),
    );

    expect(findByClass(renderedFallback, "tzr-screen-host__fallback")).toHaveLength(1);
    expect(getNodeText(renderedFallback)).toContain("Unknown screen");
    expect(getNodeText(renderedFallback)).toContain("missing");
  });

  it("calls onClose from the fallback button", () => {
    const onClose = vi.fn();
    const node = expectVNode(ScreenHost({ activeScreen: { id: "missing" }, screens: {}, onClose }));
    const surface = findByClass(node, "tzr-screen-host__surface")[0];
    const fallbackNode = expectVNode<{ readonly screenId: string; readonly onClose: () => void }>(surface?.props.children);
    const renderedFallback = expectVNode(
      (fallbackNode.type as (props: typeof fallbackNode.props) => ComponentChildren)(fallbackNode.props),
    );
    const button = findByClass(renderedFallback, "tzr-screen-host__fallback-button")[0];

    button?.props.onClick?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies className to the outer wrapper", () => {
    const node = expectVNode(
      ScreenHost({
        activeScreen: { id: "missing" },
        screens: {},
        onClose: vi.fn(),
        className: "custom-screen-host",
      }),
    );

    expect(node.props.className).toBe("tzr-screen-host custom-screen-host");
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

    node.props.onClick?.(createDivClickEvent());

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(node.props.className).toContain("tzr-message-window--advanceable");
    expect(getNodeText(node)).toContain("Click to continue");
  });

  it("calls onAdvance with Enter when advanceable", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(MessageWindow({ lines: ["Next."], onAdvance, canAdvance: true }));
    const { event, preventDefault } = createDivKeyDownEvent("Enter");

    node.props.onKeyDown?.(event);

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("calls onAdvance with Space when advanceable", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(MessageWindow({ lines: ["Next."], onAdvance, canAdvance: true }));
    const { event, preventDefault } = createDivKeyDownEvent(" ");

    node.props.onKeyDown?.(event);

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("does not call onAdvance when canAdvance=false", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(MessageWindow({ lines: ["Wait."], onAdvance, canAdvance: false }));

    node.props.onClick?.(createDivClickEvent());

    expect(onAdvance).not.toHaveBeenCalled();
    expect(node.props.onClick).toBeUndefined();
    expect(node.props.onKeyDown).toBeUndefined();
    expect(node.props.role).toBeUndefined();
    expect(node.props.tabIndex).toBeUndefined();
    expect(getNodeText(node)).not.toContain("Click to continue");
  });

  it("does not expose onKeyDown when canAdvance=false", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(MessageWindow({ lines: ["Wait."], onAdvance, canAdvance: false }));

    expect(node.props.onKeyDown).toBeUndefined();
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
            { id: "stay", text: "Stay" },
            { id: "go", text: "Go" },
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

  it("maps targetless body choice items", () => {
    const node = expectVNode<ChoiceLayerProps>(
      RuntimeMessageLayer({
        event: {
          type: "choice",
          question: "Choose",
          items: [
            { id: "openNotebook", text: "Open notebook" },
            { id: "leave", text: "Leave" },
          ],
        },
      }),
    );

    expect(node.type).toBe(ChoiceLayer);
    expect(node.props.question).toBe("Choose");
    expect(node.props.choices).toEqual([{ text: "Open notebook" }, { text: "Leave" }]);
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
      [{ type: "unsupported", instructionType: "CommandInstruction" }, "Unsupported instruction: CommandInstruction"],
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
      { type: "jump", sceneId: "later", instructionIndex: 20 },
      { type: "choiceResolve", itemIndex: 0, text: "Stay", id: "stay" },
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
      [{ type: "jump", sceneId: "later", instructionIndex: 20 }, "Jump scene: later"],
      [{ type: "choiceResolve", itemIndex: 0, text: "Stay", id: "stay" }, "Choice: Stay"],
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
