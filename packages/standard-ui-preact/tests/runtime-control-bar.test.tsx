import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import { RuntimeControlBar, type RuntimeControlBarProps } from "../src/index.js";

type ButtonProps = ComponentProps<"button">;
type NavProps = ComponentProps<"nav">;
type TestNodeProps = ComponentProps<"button"> &
  ComponentProps<"nav"> &
  ComponentProps<"span"> & {
    readonly children?: ComponentChildren;
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
    const vnode = value as VNode<TestNodeProps>;
    if (typeof vnode.type === "function") {
      return getNodeText(renderFunctionVNode(vnode));
    }
    return getNodeText(vnode.props.children);
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
  if (typeof vnode.type === "function") {
    return findByClass(renderFunctionVNode(vnode), className);
  }
  const matches = String(vnode.props.className ?? "")
    .split(" ")
    .includes(className)
    ? [vnode]
    : [];
  return [...matches, ...findByClass(vnode.props.children, className)];
}

function findButtons(value: ComponentChildren): readonly VNode<ButtonProps>[] {
  if (value === null || value === undefined || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(findButtons);
  }
  if (!isValidElement(value)) {
    return [];
  }

  const vnode = value as VNode<TestNodeProps>;
  if (typeof vnode.type === "function") {
    return findButtons(renderFunctionVNode(vnode));
  }
  const matches = vnode.type === "button" ? [vnode as VNode<ButtonProps>] : [];
  return [...matches, ...findButtons(vnode.props.children)];
}

function renderFunctionVNode(vnode: VNode<TestNodeProps>): ComponentChildren {
  return (vnode.type as (props: TestNodeProps) => ComponentChildren)(vnode.props);
}

function findButtonByText(value: ComponentChildren, text: string): VNode<ButtonProps> {
  const button = findButtons(value).find((candidate) => getNodeText(candidate) === text);
  expect(button).toBeDefined();
  if (button === undefined) {
    throw new Error(`button not found: ${text}`);
  }
  return button;
}

function clickButton(button: VNode<ButtonProps>): void {
  button.props.onClick?.({} as Parameters<NonNullable<ButtonProps["onClick"]>>[0]);
}

function renderControlBar(props: RuntimeControlBarProps = {}): VNode<NavProps> {
  return expectVNode<NavProps>(RuntimeControlBar(props));
}

describe("RuntimeControlBar", () => {
  it("renders a labelled nav and optional read status", () => {
    const node = renderControlBar({ readCount: 12, className: "app__runtime-menu", ariaLabel: "Runtime menu" });
    const status = findByClass(node, "tzr-runtime-control-bar__status")[0];

    expect(node.type).toBe("nav");
    expect(node.props.className).toBe("tzr-runtime-control-bar app__runtime-menu");
    expect(node.props["aria-label"]).toBe("Runtime menu");
    expect(status?.props["aria-label"]).toBe("Read count");
    expect(getNodeText(status)).toBe("Read: 12");
  });

  it("omits read status when readCount is not provided", () => {
    const node = renderControlBar();

    expect(findByClass(node, "tzr-runtime-control-bar__status")).toHaveLength(0);
    expect(getNodeText(node)).not.toContain("Read:");
  });

  it("reflects auto and skip pressed states", () => {
    const node = renderControlBar({
      autoModeEnabled: true,
      skipModeEnabled: false,
      onToggleAutoMode: vi.fn(),
      onToggleSkipMode: vi.fn(),
    });

    const autoButton = findButtonByText(node, "Auto");
    const skipButton = findButtonByText(node, "Skip");

    expect(autoButton.props["aria-pressed"]).toBe(true);
    expect(autoButton.props.className).toContain("tzr-runtime-control-bar__button--active");
    expect(skipButton.props["aria-pressed"]).toBe(false);
  });

  it("calls action handlers", () => {
    const handlers = {
      onToggleAutoMode: vi.fn(),
      onToggleSkipMode: vi.fn(),
      onSave: vi.fn(),
      onLoad: vi.fn(),
      onBacklog: vi.fn(),
      onSettings: vi.fn(),
      onTitle: vi.fn(),
    };
    const node = renderControlBar(handlers);

    clickButton(findButtonByText(node, "Auto"));
    clickButton(findButtonByText(node, "Skip"));
    clickButton(findButtonByText(node, "Save"));
    clickButton(findButtonByText(node, "Load"));
    clickButton(findButtonByText(node, "Backlog"));
    clickButton(findButtonByText(node, "Settings"));
    clickButton(findButtonByText(node, "Title"));

    for (const handler of Object.values(handlers)) {
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  it("disables buttons without handlers or explicitly disabled actions", () => {
    const node = renderControlBar({
      onSave: vi.fn(),
      disabled: { save: true },
    });

    expect(findButtonByText(node, "Auto").props.disabled).toBe(true);
    expect(findButtonByText(node, "Save").props.disabled).toBe(true);
    expect(findButtonByText(node, "Load").props.disabled).toBe(true);
  });

  it("hides requested controls", () => {
    const node = renderControlBar({
      readCount: 3,
      hidden: { read: true, save: true, settings: true },
    });

    expect(findByClass(node, "tzr-runtime-control-bar__status")).toHaveLength(0);
    expect(getNodeText(node)).not.toContain("Save");
    expect(getNodeText(node)).not.toContain("Settings");
    expect(getNodeText(node)).toContain("Load");
  });

  it("uses custom labels", () => {
    const node = renderControlBar({
      readCount: 2,
      labels: { read: "既読", auto: "オート", save: "セーブ" },
      onToggleAutoMode: vi.fn(),
      onSave: vi.fn(),
    });

    expect(getNodeText(findByClass(node, "tzr-runtime-control-bar__status")[0])).toBe("既読: 2");
    expect(findButtonByText(node, "オート").props.disabled).toBe(false);
    expect(findButtonByText(node, "セーブ").props.disabled).toBe(false);
  });
});
