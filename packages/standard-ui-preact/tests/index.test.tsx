import type { RuntimeEvent } from "@tsuzuru/core";
import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import {
  ChoiceLayer,
  type ChoiceLayerProps,
  defineTsuzuruGameScenario,
  GameShell,
  GameViewport,
  type GameViewportProps,
  getRuntimeNovelTextLines,
  MessageWindow,
  type MessageWindowProps,
  type MessageWindowRenderLineContext,
  NovelTextWindow,
  type NovelTextWindowProps,
  type NovelTextWindowRenderLineContext,
  RuntimeMessageLayer,
  RuntimeNovelTextLayer,
  Screen,
  ScreenActions,
  ScreenBadge,
  ScreenButton,
  type ScreenComponentProps,
  ScreenField,
  ScreenHeading,
  ScreenHost,
  type ScreenHostProps,
  ScreenList,
  ScreenListItem,
  ScreenPanel,
  ScreenText,
  StatusLayer,
  type StatusLayerProps,
  TsuzuruGame,
  type TsuzuruGameProps,
} from "../src/index.js";

type DivProps = ComponentProps<"div">;
type ButtonProps = ComponentProps<"button">;
type DivClickHandler = NonNullable<DivProps["onClick"]>;
type DivKeyDownHandler = NonNullable<DivProps["onKeyDown"]>;
type TestNodeProps = Pick<
  DivProps,
  | "aria-describedby"
  | "aria-label"
  | "children"
  | "className"
  | "id"
  | "onClick"
  | "onKeyDown"
  | "role"
  | "style"
  | "tabIndex"
> &
  Pick<ButtonProps, "disabled" | "title" | "type">;

const loc = {
  start: { filePath: "scenario/main.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/main.tzr", line: 1, column: 1 },
};

function createCompiledScenario() {
  const scenario = defineTsuzuruGameScenario({
    entryId: "scenario/main.tzr",
    documents: [
      {
        id: "scenario/main.tzr",
        source: ['title "Standard Game"', "", "scene start:", "  narration:", "    Opening line.", "  end"].join("\n"),
      },
    ],
  });
  if (!scenario.ok) {
    throw new Error("scenario did not compile");
  }
  return scenario.document;
}

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
  const matches = String(vnode.props.className ?? "")
    .split(" ")
    .includes(className)
    ? [vnode]
    : [];
  return [...matches, ...findByClass(vnode.props.children, className)];
}

function getChildNodes(value: ComponentChildren): readonly VNode<TestNodeProps>[] {
  const children = (expectVNode(value) as VNode<TestNodeProps>).props.children;
  const childList = Array.isArray(children) ? children : [children];
  return childList.filter(isValidElement) as VNode<TestNodeProps>[];
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

describe("defineTsuzuruGameScenario", () => {
  it("compiles a scenario with standard visual and audio commands", () => {
    const scenario = defineTsuzuruGameScenario({
      entryId: "scenario/standard-game.tzr",
      documents: [
        {
          id: "scenario/standard-game.tzr",
          source: [
            'title "Standard Game"',
            "",
            "scene start:",
            "  bg station",
            "  bgm daily_theme",
            "  narration:",
            "    Opening line.",
            "  end",
          ].join("\n"),
        },
      ],
    });

    expect(scenario.ok).toBe(true);
    if (!scenario.ok) {
      throw new Error("scenario did not compile");
    }

    expect(scenario.document.filePath).toBe("scenario/standard-game.tzr");
    expect(scenario.document.instructions.map((instruction) => instruction.type)).toContain("CommandInstruction");
  });

  it("returns parse diagnostics instead of throwing", () => {
    const scenario = defineTsuzuruGameScenario({
      entryId: "scenario/broken.tzr",
      documents: [{ id: "scenario/broken.tzr", source: "scene start:\n  choice:\n" }],
    });

    expect(scenario.ok).toBe(false);
    if (scenario.ok) {
      throw new Error("scenario unexpectedly compiled");
    }
    expect(scenario.errors[0]?.filePath).toBe("scenario/broken.tzr");
  });
});

describe("TsuzuruGame", () => {
  it("keeps dialogue presentation as the default runtime prop", () => {
    const scenario = createCompiledScenario();
    const node = expectVNode<{ readonly messagePresentation?: TsuzuruGameProps["messagePresentation"] }>(
      TsuzuruGame({ scenario, autoStart: false }),
    );

    expect(node.props.messagePresentation).toBeUndefined();
  });

  it("passes string novel presentation to the runtime layer", () => {
    const scenario = createCompiledScenario();
    const node = expectVNode<{ readonly messagePresentation?: TsuzuruGameProps["messagePresentation"] }>(
      TsuzuruGame({ scenario, autoStart: false, messagePresentation: "novel" }),
    );

    expect(node.props.messagePresentation).toBe("novel");
  });

  it("passes object novel presentation options to the runtime layer", () => {
    const scenario = createCompiledScenario();
    const messagePresentation = { mode: "novel", speakerMode: "block" } as const;
    const node = expectVNode<{ readonly messagePresentation?: TsuzuruGameProps["messagePresentation"] }>(
      TsuzuruGame({ scenario, autoStart: false, messagePresentation }),
    );

    expect(node.props.messagePresentation).toBe(messagePresentation);
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
    const fallbackNode = expectVNode<{ readonly screenId: string; readonly onClose: () => void }>(
      surface?.props.children,
    );
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
    const fallbackNode = expectVNode<{ readonly screenId: string; readonly onClose: () => void }>(
      surface?.props.children,
    );
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

describe("Screen primitives", () => {
  it("renders Screen as a section with the default variant", () => {
    const node = expectVNode(Screen({ "aria-label": "Settings", children: "menu", className: "custom-screen" }));

    expect(node.type).toBe("section");
    expect(node.props["aria-label"]).toBe("Settings");
    expect(node.props.className).toBe("tzr-screen tzr-screen--default custom-screen");
    expect(getNodeText(node)).toBe("menu");
  });

  it("applies the Screen variant modifier", () => {
    const node = expectVNode(Screen({ variant: "overlay", children: "overlay" }));

    expect(node.type).toBe("section");
    expect(node.props.className).toBe("tzr-screen tzr-screen--overlay");
  });

  it("renders ScreenPanel children", () => {
    const node = expectVNode(ScreenPanel({ children: "panel", className: "custom-panel" }));

    expect(node.type).toBe("div");
    expect(node.props.className).toBe("tzr-screen__panel custom-panel");
    expect(getNodeText(node)).toBe("panel");
  });

  it("renders ScreenHeading eyebrow and heading", () => {
    const node = expectVNode(ScreenHeading({ eyebrow: "System", children: "Settings" }));
    const heading = findByClass(node, "tzr-screen__heading")[0];

    expect(findByClass(node, "tzr-screen__eyebrow")).toHaveLength(1);
    expect(findByClass(node, "tzr-screen__heading")).toHaveLength(1);
    expect(heading.type).toBe("h1");
    expect(getNodeText(node)).toContain("System");
    expect(getNodeText(node)).toContain("Settings");
  });

  it("applies the ScreenActions columns modifier", () => {
    const node = expectVNode(ScreenActions({ columns: 2, children: "actions" }));

    expect(node.props.className).toBe("tzr-screen__actions tzr-screen__actions--columns-2");
  });

  it("renders ScreenText as a paragraph with native props", () => {
    const node = expectVNode(ScreenText({ "aria-label": "Description", children: "Body", className: "custom-text" }));

    expect(node.type).toBe("p");
    expect(node.props["aria-label"]).toBe("Description");
    expect(node.props.className).toBe("tzr-screen__text custom-text");
    expect(getNodeText(node)).toBe("Body");
  });

  it("renders ScreenButton as a disabled button with native props", () => {
    const onClick = vi.fn();
    const node = expectVNode(
      ScreenButton({
        disabled: true,
        onClick,
        title: "Start the game",
        variant: "primary",
        children: "Start",
      }),
    );

    expect(node.type).toBe("button");
    expect(node.props.className).toBe("tzr-screen__button tzr-screen__button--primary");
    expect(node.props.type).toBe("button");
    expect(node.props.disabled).toBe(true);
    expect(node.props.title).toBe("Start the game");
    expect(node.props.onClick).toBe(onClick);
  });

  it("renders ScreenField without controlId as a div with span label, content, and hint", () => {
    const node = expectVNode(
      ScreenField({
        label: "Text speed",
        hint: "Normal",
        hintId: "text-speed-hint",
        className: "custom-field",
        children: <span>Normal</span>,
      }),
    );
    const hint = findByClass(node, "tzr-screen__field-hint")[0];
    const label = findByClass(node, "tzr-screen__field-label")[0];
    const control = findByClass(node, "tzr-screen__field-control")[0];

    expect(node.type).toBe("div");
    expect(node.props.className).toBe("tzr-screen__field custom-field");
    expect(label.type).toBe("span");
    expect(findByClass(node, "tzr-screen__field-label")).toHaveLength(1);
    expect(findByClass(node, "tzr-screen__field-control")).toHaveLength(1);
    expect(findByClass(node, "tzr-screen__field-hint")).toHaveLength(1);
    expect(hint.props.id).toBe("text-speed-hint");
    expect(getNodeText(control)).toBe("Normal");
    expect(getNodeText(node)).toContain("Text speed");
    expect(getNodeText(node)).toContain("Normal");
  });

  it("renders ScreenField label as a label when controlId is provided", () => {
    const node = expectVNode(
      ScreenField({
        label: "Text reveal",
        controlId: "text-reveal-control",
        hint: "Reveal message text over time.",
        hintId: "text-reveal-hint",
        children: <input id="text-reveal-control" type="checkbox" aria-describedby="text-reveal-hint" />,
      }),
    );
    const label = findByClass(node, "tzr-screen__field-label")[0];
    const hint = findByClass(node, "tzr-screen__field-hint")[0];
    const control = findByClass(node, "tzr-screen__field-control")[0];
    const input = getChildNodes(control)[0];

    expect(node.type).toBe("div");
    expect(label.type).toBe("label");
    expect(label.props.htmlFor).toBe("text-reveal-control");
    expect(hint.props.id).toBe("text-reveal-hint");
    expect(input.props.id).toBe("text-reveal-control");
    expect(input.props["aria-describedby"]).toBe("text-reveal-hint");
  });

  it("renders ScreenList as ul by default", () => {
    const node = expectVNode(ScreenList({ children: <ScreenListItem>Slot 1</ScreenListItem> }));

    expect(node.type).toBe("ul");
    expect(node.props.role).toBe("list");
    expect(node.props.className).toBe("tzr-screen__list");
    expect(getNodeText(node)).toBe("Slot 1");
  });

  it("renders ScreenList as ol when ordered", () => {
    const node = expectVNode(ScreenList({ ordered: true, children: <ScreenListItem>Log 1</ScreenListItem> }));

    expect(node.type).toBe("ol");
    expect(node.props.role).toBe("list");
    expect(node.props.className).toBe("tzr-screen__list");
    expect(getNodeText(node)).toBe("Log 1");
  });

  it("renders ScreenListItem as li", () => {
    const node = expectVNode(ScreenListItem({ children: "Entry", className: "custom-entry" }));

    expect(node.type).toBe("li");
    expect(node.props.className).toBe("tzr-screen__list-item custom-entry");
    expect(getNodeText(node)).toBe("Entry");
  });

  it("renders ScreenBadge as span", () => {
    const node = expectVNode(ScreenBadge({ children: "Read", className: "custom-badge" }));

    expect(node.type).toBe("span");
    expect(node.props.className).toBe("tzr-screen__badge custom-badge");
    expect(getNodeText(node)).toBe("Read");
  });
});

describe("MessageWindow", () => {
  it("renders narration without speaker", () => {
    const node = expectVNode(MessageWindow({ lines: ["It was raining."] }));
    const lineContainers = findByClass(node, "tzr-message-window__lines");

    expect(node.props.className).toContain("tzr-message-window--narration");
    expect(findByClass(node, "tzr-message-window__speaker")).toHaveLength(0);
    expect(lineContainers).toHaveLength(1);
    expect(getNodeText(node)).toContain("It was raining.");
  });

  it("renders dialogue with speaker", () => {
    const node = expectVNode(MessageWindow({ speaker: "Haruka", lines: ["You're late."] }));
    const speakers = findByClass(node, "tzr-message-window__speaker");
    const lineContainers = findByClass(node, "tzr-message-window__lines");

    expect(node.props.className).toContain("tzr-message-window--dialogue");
    expect(speakers).toHaveLength(1);
    expect(speakers[0].props["aria-label"]).toBe("Speaker");
    expect(lineContainers).toHaveLength(1);
    expect(getNodeText(node)).toContain("Haruka");
    expect(getNodeText(node)).toContain("You're late.");
  });

  it("keeps speaker outside the stable line container", () => {
    const node = expectVNode(MessageWindow({ speaker: "Haruka", lines: ["You're late."] }));
    const directChildClassNames = getChildNodes(node).map((child) => child.props.className);
    const lineContainers = findByClass(node, "tzr-message-window__lines");

    expect(directChildClassNames).toEqual(["tzr-message-window__speaker", "tzr-message-window__lines"]);
    expect(getNodeText(lineContainers[0])).toBe("You're late.");
    expect(findByClass(lineContainers[0], "tzr-message-window__speaker")).toHaveLength(0);
  });

  it("renders default line content inside stable line elements", () => {
    const node = expectVNode(MessageWindow({ lines: ["Line one.", "Line two."] }));
    const lines = findByClass(node, "tzr-message-window__line");

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => getNodeText(line))).toEqual(["Line one.", "Line two."]);
  });

  it("renders custom line content with renderLine", () => {
    const receivedContexts: MessageWindowRenderLineContext[] = [];
    const node = expectVNode(
      MessageWindow({
        lines: ["Line one.", "Line two."],
        renderLine: (context) => {
          receivedContexts.push(context);
          return <span className="custom-line">{`${context.lineIndex}:${context.line}`}</span>;
        },
      }),
    );
    const lineNodes = findByClass(node, "tzr-message-window__line");
    const customLineNodes = findByClass(node, "custom-line");

    expect(lineNodes).toHaveLength(2);
    expect(customLineNodes.map((line) => getNodeText(line))).toEqual(["0:Line one.", "1:Line two."]);
  });

  it("passes line and lineIndex to renderLine", () => {
    const receivedContexts: MessageWindowRenderLineContext[] = [];
    MessageWindow({
      lines: ["Alpha", "Beta"],
      renderLine: (context) => {
        receivedContexts.push(context);
        return context.line;
      },
    });

    expect(receivedContexts).toEqual([
      { line: "Alpha", lineIndex: 0 },
      { line: "Beta", lineIndex: 1 },
    ]);
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

describe("NovelTextWindow", () => {
  it("renders lines in a novel text body", () => {
    const node = expectVNode(NovelTextWindow({ lines: ["The snow would not stop.", "The lodge was silent."] }));
    const body = findByClass(node, "tzr-novel-text-window__body");
    const lines = findByClass(node, "tzr-novel-text-window__line");

    expect(node.props.className).toContain("tzr-novel-text-window");
    expect(node.props.className).toContain("tzr-novel-text-window--fullscreen");
    expect(body).toHaveLength(1);
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => getNodeText(line))).toEqual(["The snow would not stop.", "The lodge was silent."]);
  });

  it("renders custom line content with renderLine", () => {
    const receivedContexts: NovelTextWindowRenderLineContext[] = [];
    const node = expectVNode(
      NovelTextWindow({
        lines: ["Line one.", "Line two."],
        renderLine: (context) => {
          receivedContexts.push(context);
          return <span className="custom-novel-line">{`${context.lineIndex}:${context.line}`}</span>;
        },
      }),
    );

    expect(findByClass(node, "custom-novel-line").map((line) => getNodeText(line))).toEqual([
      "0:Line one.",
      "1:Line two.",
    ]);
    expect(receivedContexts).toEqual([
      { line: "Line one.", lineIndex: 0 },
      { line: "Line two.", lineIndex: 1 },
    ]);
  });

  it("calls onAdvance when clicked in an advanceable state", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(NovelTextWindow({ lines: ["Next."], onAdvance, canAdvance: true }));

    node.props.onClick?.(createDivClickEvent());

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(node.props.className).toContain("tzr-novel-text-window--advanceable");
    expect(getNodeText(node)).toContain("Click to continue");
  });

  it("calls onAdvance with Enter and Space in an advanceable state", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(NovelTextWindow({ lines: ["Next."], onAdvance, canAdvance: true }));
    const enter = createDivKeyDownEvent("Enter");
    const space = createDivKeyDownEvent(" ");

    node.props.onKeyDown?.(enter.event);
    node.props.onKeyDown?.(space.event);

    expect(onAdvance).toHaveBeenCalledTimes(2);
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(space.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("does not become advanceable when canAdvance=false", () => {
    const onAdvance = vi.fn();
    const node = expectVNode(NovelTextWindow({ lines: ["Wait."], onAdvance, canAdvance: false }));

    node.props.onClick?.(createDivClickEvent());

    expect(onAdvance).not.toHaveBeenCalled();
    expect(node.props.className).not.toContain("tzr-novel-text-window--advanceable");
    expect(node.props.onClick).toBeUndefined();
    expect(node.props.onKeyDown).toBeUndefined();
    expect(node.props.role).toBeUndefined();
    expect(node.props.tabIndex).toBeUndefined();
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

  it("passes renderMessageLine to narration MessageWindow", () => {
    const renderMessageLine = vi.fn(({ line }: MessageWindowRenderLineContext) => <span>{line}</span>);
    const node = expectVNode<MessageWindowProps>(
      RuntimeMessageLayer({
        event: { type: "narration", lines: [{ text: "The room was quiet.", loc }] },
        renderMessageLine,
      }),
    );

    expect(node.type).toBe(MessageWindow);
    expect(node.props.renderLine).toBe(renderMessageLine);
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

  it("passes renderMessageLine to dialogue MessageWindow", () => {
    const renderMessageLine = vi.fn(({ line }: MessageWindowRenderLineContext) => <span>{line}</span>);
    const node = expectVNode<MessageWindowProps>(
      RuntimeMessageLayer({
        event: { type: "dialogue", speaker: "Yu", lines: [{ text: "I made it.", loc }] },
        renderMessageLine,
      }),
    );

    expect(node.type).toBe(MessageWindow);
    expect(node.props.renderLine).toBe(renderMessageLine);
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

  it("does not pass renderMessageLine to choice rendering", () => {
    const node = expectVNode<ChoiceLayerProps & { readonly renderLine?: unknown }>(
      RuntimeMessageLayer({
        event: {
          type: "choice",
          question: "What do you do?",
          items: [{ id: "stay", text: "Stay" }],
        },
        renderMessageLine: ({ line }) => line,
      }),
    );

    expect(node.type).toBe(ChoiceLayer);
    expect(node.props.renderLine).toBeUndefined();
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

  it("does not pass renderMessageLine to status rendering", () => {
    const node = expectVNode<StatusLayerProps & { readonly renderLine?: unknown }>(
      RuntimeMessageLayer({
        event: { type: "wait", durationMs: 500 },
        renderMessageLine: ({ line }) => line,
      }),
    );

    expect(node.type).toBe(StatusLayer);
    expect(node.props.renderLine).toBeUndefined();
  });

  it("hides transient events by default", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "scene", id: "prologue" },
      { type: "jump", sceneId: "later", instructionIndex: 20 },
      { type: "choiceResolve", itemIndex: 0, text: "Stay", id: "stay" },
      { type: "if", result: true, branch: "then" },
      { type: "state", command: "set", name: "scenario.metHaruka", value: true },
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

describe("RuntimeNovelTextLayer", () => {
  it("maps narration to NovelTextWindow", () => {
    const node = expectVNode<NovelTextWindowProps>(
      RuntimeNovelTextLayer({
        event: { type: "narration", lines: [{ text: "The room was quiet.", loc }] },
        onAdvance: vi.fn(),
        canAdvance: true,
      }),
    );

    expect(node.type).toBe(NovelTextWindow);
    expect(node.props.lines).toEqual(["The room was quiet."]);
  });

  it("maps dialogue with speakerMode=inline by default", () => {
    const node = expectVNode<NovelTextWindowProps>(
      RuntimeNovelTextLayer({
        event: { type: "dialogue", speaker: "Mio", lines: [{ text: "Listen closely.", loc }] },
      }),
    );

    expect(node.type).toBe(NovelTextWindow);
    expect(node.props.lines).toEqual(["Mio「Listen closely.」"]);
  });

  it("maps multi-line dialogue with speakerMode=inline", () => {
    const node = expectVNode<NovelTextWindowProps>(
      RuntimeNovelTextLayer({
        event: {
          type: "dialogue",
          speaker: "Mio",
          lines: [
            { text: "Listen closely.", loc },
            { text: "Something is outside.", loc },
          ],
        },
      }),
    );

    expect(node.props.lines).toEqual(["Mio「Listen closely.", "Something is outside.」"]);
  });

  it("maps dialogue with speakerMode=block", () => {
    const node = expectVNode<NovelTextWindowProps>(
      RuntimeNovelTextLayer({
        event: { type: "dialogue", speaker: "Mio", lines: [{ text: "Listen closely.", loc }] },
        speakerMode: "block",
      }),
    );

    expect(node.type).toBe(NovelTextWindow);
    expect(node.props.lines).toEqual(["【Mio】", "Listen closely."]);
  });

  it("exports the novel text line formatter", () => {
    expect(
      getRuntimeNovelTextLines(
        { type: "dialogue", speaker: "Mio", lines: [{ text: "Listen closely.", loc }] },
        "block",
      ),
    ).toEqual(["【Mio】", "Listen closely."]);
  });

  it("maps dialogue with speakerMode=hidden", () => {
    const node = expectVNode<NovelTextWindowProps>(
      RuntimeNovelTextLayer({
        event: { type: "dialogue", speaker: "Mio", lines: [{ text: "Listen closely.", loc }] },
        speakerMode: "hidden",
      }),
    );

    expect(node.type).toBe(NovelTextWindow);
    expect(node.props.lines).toEqual(["Listen closely."]);
  });

  it("passes renderMessageLine to NovelTextWindow", () => {
    const renderMessageLine = vi.fn(({ line }: NovelTextWindowRenderLineContext) => <span>{line}</span>);
    const node = expectVNode<NovelTextWindowProps>(
      RuntimeNovelTextLayer({
        event: { type: "narration", lines: [{ text: "The room was quiet.", loc }] },
        renderMessageLine,
      }),
    );

    expect(node.type).toBe(NovelTextWindow);
    expect(node.props.renderLine).toBe(renderMessageLine);
  });

  it("maps choice to ChoiceLayer and selects by index", () => {
    const onChoice = vi.fn();
    const node = expectVNode<ChoiceLayerProps>(
      RuntimeNovelTextLayer({
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
    const renderedChoice = expectVNode((node.type as (props: ChoiceLayerProps) => ComponentChildren)(node.props));

    findByClass(renderedChoice, "tzr-choice-layer__button")[1]?.props.onClick?.();
    expect(onChoice).toHaveBeenCalledWith(1);
  });

  it("maps waitClick and page like RuntimeMessageLayer", () => {
    const onContinue = vi.fn();
    const waitClick = expectVNode<StatusLayerProps>(
      RuntimeNovelTextLayer({ event: { type: "waitClick" }, onContinue, continueLabel: "Next" }),
    );
    const page = expectVNode<StatusLayerProps>(RuntimeNovelTextLayer({ event: { type: "page" }, onContinue }));

    expect(waitClick.type).toBe(StatusLayer);
    expect(waitClick.props.label).toBe("Waiting for click");
    expect(waitClick.props.buttonLabel).toBe("Next");
    expect(waitClick.props.onButtonClick).toBe(onContinue);
    expect(page.props.label).toBe("Page break");
    expect(page.props.buttonLabel).toBe("Continue");
  });
});
