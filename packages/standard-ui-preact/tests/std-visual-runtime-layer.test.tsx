import type { RuntimeState } from "@tsuzuru/core";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StdVisualRuntimeLayer, type StdVisualRuntimeLayerProps } from "../src/index.js";

interface MinimalStyle {
  readonly values: ReadonlyMap<string, string>;
  [name: string]: unknown;
  setProperty(name: string, value: string): void;
  removeProperty(name: string): void;
  getPropertyValue(name: string): string;
}

interface MinimalElement {
  readonly nodeType: 1;
  readonly namespaceURI: string;
  readonly localName: string;
  readonly attributes: readonly [];
  readonly style: MinimalStyle;
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
  getAttribute(name: string): string | null;
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
}

interface VisualRuntimeLayerHarness {
  readonly root: MinimalElement;
  readonly unmount: () => void;
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

function createMinimalElement(localName: string, namespaceURI = "http://www.w3.org/1999/xhtml"): MinimalElement {
  const attributes = new Map<string, string>();
  const element: MinimalElement = {
    nodeType: 1,
    namespaceURI,
    localName,
    attributes: [],
    style: createMinimalStyle(),
    className: "",
    parentNode: null,
    childNodes: [],
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
      attributes.set(name, value);
      if (name === "class") {
        this.className = value;
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
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
    getAttribute(name) {
      return attributes.get(name) ?? null;
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

function createMinimalDocument(): MinimalDocument {
  return {
    documentElement: createMinimalElement("html"),
    createElementNS: (namespaceURI, localName) => createMinimalElement(localName, namespaceURI),
    createTextNode: createMinimalText,
  };
}

function installMinimalDom(): void {
  Object.assign(globalThis, {
    document: createMinimalDocument(),
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

function mountVisualRuntimeLayer(props: StdVisualRuntimeLayerProps): VisualRuntimeLayerHarness {
  const root = createMinimalElement("div");
  act(() => {
    render(h(StdVisualRuntimeLayer, props), root as unknown as Element);
  });
  return {
    root,
    unmount: () => {
      act(() => {
        render(null, root as unknown as Element);
      });
    },
  };
}

function findByClass(value: MinimalNode | readonly MinimalNode[], className: string): readonly MinimalElement[] {
  if (Array.isArray(value)) {
    return value.flatMap((node) => findByClass(node, className));
  }
  if (value.nodeType !== 1) {
    return [];
  }
  const matches = value.className.split(" ").includes(className) ? [value] : [];
  return [...matches, ...value.childNodes.flatMap((node) => findByClass(node, className))];
}

function getNodeText(value: MinimalNode | readonly MinimalNode[]): string {
  if (Array.isArray(value)) {
    return value.map((node) => getNodeText(node)).join("");
  }
  if (value.nodeType === 3) {
    return value.data;
  }
  return value.childNodes.map((node) => getNodeText(node)).join("");
}

function runtimeStateWithVisual(): RuntimeState {
  return {
    plugins: {
      stdVisual: {
        background: { assetId: "station" },
        sprites: {
          mio_smile: { position: "center" },
        },
      },
    },
  } as RuntimeState;
}

describe("StdVisualRuntimeLayer", () => {
  const harnesses: VisualRuntimeLayerHarness[] = [];

  beforeEach(() => {
    installMinimalDom();
  });

  afterEach(() => {
    for (const harness of harnesses.splice(0)) {
      harness.unmount();
    }
    uninstallMinimalDom();
  });

  it("reads std visual state from runtime state and renders asset-backed images", () => {
    const harness = mountVisualRuntimeLayer({
      runtimeState: runtimeStateWithVisual(),
      backgroundAssets: { station: "/assets/backgrounds/station.svg" },
      spriteAssets: { mio_smile: { src: "/assets/sprites/mio_smile.svg", alt: "Mio" } },
      className: "runtime-visual-layer",
    });
    harnesses.push(harness);
    const background = findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background")[0];
    const sprite = findByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite")[0];

    expect(findByClass(harness.root.childNodes, "runtime-visual-layer")).toHaveLength(1);
    expect(background?.localName).toBe("img");
    expect(background?.getAttribute("src")).toBe("/assets/backgrounds/station.svg");
    expect(sprite?.localName).toBe("img");
    expect(sprite?.getAttribute("src")).toBe("/assets/sprites/mio_smile.svg");
    expect(sprite?.getAttribute("alt")).toBe("Mio");
    expect(sprite?.className).toContain("tzr-tsuzuru-game__sprite--center");
  });

  it("uses StdVisualLayer placeholders when assets are missing", () => {
    const harness = mountVisualRuntimeLayer({ runtimeState: runtimeStateWithVisual() });
    harnesses.push(harness);

    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background-placeholder")).toHaveLength(1);
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite-placeholder")).toHaveLength(1);
    expect(getNodeText(harness.root.childNodes)).toContain("station");
    expect(getNodeText(harness.root.childNodes)).toContain("mio_smile");
  });

  it("uses the plugin state reader missing-plugin error", () => {
    expect(() => StdVisualRuntimeLayer({ runtimeState: { plugins: {} } as RuntimeState })).toThrow(
      "runtimeState.plugins.stdVisual is not initialized. Register createStdVisualPlugin().",
    );
  });
});
