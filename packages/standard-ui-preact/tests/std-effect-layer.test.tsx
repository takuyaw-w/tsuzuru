import type { StdEffectEvent } from "@tsuzuru/plugin-std-effect";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STD_EFFECT_TARGET_NOT_FOUND_DIAGNOSTIC_CODE, StdEffectLayer, type StdEffectLayerProps } from "../src/index.js";

interface MinimalStyle {
  readonly values: ReadonlyMap<string, string>;
  setProperty(name: string, value: string): void;
  removeProperty(name: string): void;
  getPropertyValue(name: string): string;
}

interface MinimalClassList {
  readonly addCalls: readonly string[];
  readonly removeCalls: readonly string[];
  add(...classNames: string[]): void;
  remove(...classNames: string[]): void;
  contains(className: string): boolean;
}

interface MinimalElement {
  readonly nodeType: 1;
  readonly namespaceURI: string;
  readonly localName: string;
  readonly attributes: readonly [];
  readonly style: MinimalStyle;
  readonly classList: MinimalClassList;
  readonly offsetWidth: number;
  className: string;
  parentNode: MinimalElement | null;
  childNodes: MinimalNode[];
  readonly firstChild: MinimalNode | null;
  readonly nextSibling: MinimalNode | null;
  appendChild(node: MinimalNode): MinimalNode;
  insertBefore(node: MinimalNode, before: MinimalNode | null): MinimalNode;
  removeChild(node: MinimalNode): MinimalNode;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(name: string, listener: EventListener): void;
  removeEventListener(name: string, listener: EventListener): void;
}

interface MinimalText {
  readonly nodeType: 3;
  data: string;
  parentNode: MinimalElement | null;
  readonly nextSibling: MinimalNode | null;
}

type MinimalNode = MinimalElement | MinimalText;

interface MinimalDocument {
  readonly documentElement: MinimalElement;
  createElementNS(namespaceURI: string, localName: string): MinimalElement;
  createTextNode(data: string): MinimalText;
  querySelector<T extends Element = Element>(selector: string): T | null;
}

function createMinimalStyle(): MinimalStyle {
  const values = new Map<string, string>();
  return {
    values,
    setProperty(name, value) {
      values.set(name, value);
    },
    removeProperty(name) {
      values.delete(name);
    },
    getPropertyValue(name) {
      return values.get(name) ?? "";
    },
  };
}

function createMinimalClassList(onChange: (className: string) => void): MinimalClassList {
  const classNames = new Set<string>();
  const addCalls: string[] = [];
  const removeCalls: string[] = [];
  return {
    addCalls,
    removeCalls,
    add(...nextClassNames) {
      for (const className of nextClassNames) {
        addCalls.push(className);
        classNames.add(className);
      }
      onChange([...classNames].join(" "));
    },
    remove(...nextClassNames) {
      for (const className of nextClassNames) {
        removeCalls.push(className);
        classNames.delete(className);
      }
      onChange([...classNames].join(" "));
    },
    contains(className) {
      return classNames.has(className);
    },
  };
}

function createMinimalElement(localName: string, namespaceURI = "http://www.w3.org/1999/xhtml"): MinimalElement {
  const style = createMinimalStyle();
  const element: MinimalElement = {
    nodeType: 1,
    namespaceURI,
    localName,
    attributes: [],
    style,
    offsetWidth: 1,
    className: "",
    parentNode: null,
    childNodes: [],
    classList: createMinimalClassList((className) => {
      element.className = className;
    }),
    get firstChild() {
      return this.childNodes[0] ?? null;
    },
    get nextSibling() {
      return nextSiblingOf(this);
    },
    appendChild(node) {
      node.parentNode = this;
      this.childNodes.push(node);
      return node;
    },
    insertBefore(node, before) {
      node.parentNode = this;
      const index = before === null ? -1 : this.childNodes.indexOf(before);
      if (index === -1) {
        this.childNodes.push(node);
      } else {
        this.childNodes.splice(index, 0, node);
      }
      return node;
    },
    removeChild(node) {
      this.childNodes = this.childNodes.filter((child) => child !== node);
      node.parentNode = null;
      return node;
    },
    setAttribute(name, value) {
      if (name === "class") {
        this.className = value;
      }
    },
    removeAttribute(name) {
      if (name === "class") {
        this.className = "";
      }
    },
    addEventListener() {
      return undefined;
    },
    removeEventListener() {
      return undefined;
    },
  };
  return element;
}

function createMinimalText(data: string): MinimalText {
  return {
    nodeType: 3,
    data,
    parentNode: null,
    get nextSibling() {
      return nextSiblingOf(this);
    },
  };
}

function nextSiblingOf(node: MinimalNode): MinimalNode | null {
  const siblings = node.parentNode?.childNodes;
  if (siblings === undefined) {
    return null;
  }
  const index = siblings.indexOf(node);
  return index === -1 ? null : (siblings[index + 1] ?? null);
}

function createMinimalDocument(targets: ReadonlyMap<string, MinimalElement>): MinimalDocument {
  return {
    documentElement: createMinimalElement("html"),
    createElementNS: (namespaceURI, localName) => createMinimalElement(localName, namespaceURI),
    createTextNode: createMinimalText,
    querySelector: (selector) => (targets.get(selector) as Element | undefined) ?? null,
  };
}

function installMinimalDom(targets: ReadonlyMap<string, MinimalElement>): void {
  const minimalDocument = createMinimalDocument(targets);
  Object.assign(globalThis, {
    document: minimalDocument,
    window: {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
  });
}

function uninstallMinimalDom(): void {
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "window");
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceTimersByTime(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
  });
}

function findElementsByLocalName(
  value: MinimalNode | readonly MinimalNode[],
  localName: string,
): readonly MinimalElement[] {
  if (Array.isArray(value)) {
    return value.flatMap((child) => findElementsByLocalName(child, localName));
  }
  if (value.nodeType !== 1) {
    return [];
  }
  const matches = value.localName === localName ? [value] : [];
  return [...matches, ...value.childNodes.flatMap((child) => findElementsByLocalName(child, localName))];
}

const flashEvent = {
  sequence: 1,
  type: "flash",
  color: "#fff",
  durationMs: 100,
} satisfies StdEffectEvent;

describe("StdEffectLayer", () => {
  const roots: MinimalElement[] = [];
  let targets: Map<string, MinimalElement>;

  beforeEach(() => {
    vi.useFakeTimers();
    targets = new Map();
    installMinimalDom(targets);
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        render(null, root as unknown as Element);
      });
    }
    uninstallMinimalDom();
    vi.useRealTimers();
  });

  async function mountEffect(initialProps: StdEffectLayerProps): Promise<{
    readonly root: MinimalElement;
    readonly update: (nextProps: StdEffectLayerProps) => Promise<void>;
    readonly unmount: () => void;
  }> {
    const root = createMinimalElement("div");
    roots.push(root);

    const update = async (nextProps: StdEffectLayerProps) => {
      await act(async () => {
        render(h(StdEffectLayer, nextProps), root as unknown as Element);
      });
      await flushEffects();
    };

    await update(initialProps);

    return {
      root,
      update,
      unmount: () => {
        act(() => {
          render(null, root as unknown as Element);
        });
      },
    };
  }

  it("renders and clears flash overlays", async () => {
    const harness = await mountEffect({ events: [flashEvent], nextSequence: 2 });

    expect(findElementsByLocalName(harness.root.childNodes, "span")).toHaveLength(1);

    await advanceTimersByTime(100);

    expect(findElementsByLocalName(harness.root.childNodes, "span")).toHaveLength(0);
  });

  it("adds and clears shake and pulse classes on target elements", async () => {
    const screen = createMinimalElement("div");
    const message = createMinimalElement("div");
    targets.set(".screen", screen);
    targets.set(".message", message);

    await mountEffect({
      events: [
        { sequence: 1, type: "shake", target: "screen", intensity: "strong", durationMs: 80 },
        { sequence: 2, type: "pulse", target: "message", intensity: "light", durationMs: 120 },
      ],
      nextSequence: 3,
      targetSelectors: { screen: ".screen", message: ".message" },
    });

    expect(screen.classList.contains("tzr-std-effect--shake-strong")).toBe(true);
    expect(screen.style.getPropertyValue("--tzr-effect-duration")).toBe("80ms");
    expect(message.classList.contains("tzr-std-effect--pulse-light")).toBe(true);
    expect(message.style.getPropertyValue("--tzr-effect-duration")).toBe("120ms");

    await advanceTimersByTime(80);

    expect(screen.classList.contains("tzr-std-effect--shake-strong")).toBe(false);
    expect(screen.style.getPropertyValue("--tzr-effect-duration")).toBe("");
    expect(message.classList.contains("tzr-std-effect--pulse-light")).toBe(true);

    await advanceTimersByTime(40);

    expect(message.classList.contains("tzr-std-effect--pulse-light")).toBe(false);
    expect(message.style.getPropertyValue("--tzr-effect-duration")).toBe("");
  });

  it("adds and clears blur class and CSS amount", async () => {
    const screen = createMinimalElement("div");
    targets.set(".screen", screen);

    await mountEffect({
      events: [{ sequence: 1, type: "blur", target: "screen", amount: 6, durationMs: 90 }],
      nextSequence: 2,
      targetSelectors: { screen: ".screen" },
    });

    expect(screen.classList.contains("tzr-std-effect--blur")).toBe(true);
    expect(screen.style.getPropertyValue("--tzr-effect-blur-amount")).toBe("6px");

    await advanceTimersByTime(90);

    expect(screen.classList.contains("tzr-std-effect--blur")).toBe(false);
    expect(screen.style.getPropertyValue("--tzr-effect-blur-amount")).toBe("");
  });

  it("does not re-run the same sequence on re-render", async () => {
    const screen = createMinimalElement("div");
    const event = { sequence: 1, type: "shake", target: "screen", intensity: "normal", durationMs: 100 } as const;
    targets.set(".screen", screen);
    const harness = await mountEffect({
      events: [event],
      targetSelectors: { screen: ".screen" },
    });

    expect(screen.classList.addCalls.filter((className) => className === "tzr-std-effect--shake-normal")).toHaveLength(
      1,
    );

    await harness.update({
      events: [event],
      targetSelectors: { screen: ".screen" },
    });

    expect(screen.classList.addCalls.filter((className) => className === "tzr-std-effect--shake-normal")).toHaveLength(
      1,
    );
  });

  it("reports missing effect targets", async () => {
    const onDiagnostic = vi.fn();
    const event = { sequence: 1, type: "pulse", target: "sprites", intensity: "normal", durationMs: 100 } as const;

    await mountEffect({
      events: [event],
      targetSelectors: { sprites: ".missing-sprites" },
      onDiagnostic,
    });

    expect(onDiagnostic).toHaveBeenCalledWith({
      code: STD_EFFECT_TARGET_NOT_FOUND_DIAGNOSTIC_CODE,
      event,
      message: 'Effect target "sprites" was not found for selector ".missing-sprites".',
    });
  });

  it("cleans up active target effects on unmount", async () => {
    const screen = createMinimalElement("div");
    targets.set(".screen", screen);
    const harness = await mountEffect({
      events: [{ sequence: 1, type: "shake", target: "screen", intensity: "normal", durationMs: 1000 }],
      targetSelectors: { screen: ".screen" },
    });

    expect(screen.classList.contains("tzr-std-effect--shake-normal")).toBe(true);

    harness.unmount();

    expect(screen.classList.contains("tzr-std-effect--shake-normal")).toBe(false);
  });
});
