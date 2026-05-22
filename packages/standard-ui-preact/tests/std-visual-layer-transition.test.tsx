import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StdVisualLayer, type StdVisualLayerProps } from "../src/index.js";

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

interface VisualLayerHarness {
  readonly root: MinimalElement;
  readonly update: (props: StdVisualLayerProps) => void;
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

function mountVisualLayer(props: StdVisualLayerProps): VisualLayerHarness {
  const root = createMinimalElement("div");
  const update = (nextProps: StdVisualLayerProps) => {
    act(() => {
      render(h(StdVisualLayer, nextProps), root as unknown as Element);
    });
  };

  update(props);

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

function getNodeText(value: MinimalNode | readonly MinimalNode[]): string {
  if (Array.isArray(value)) {
    return value.map((node) => getNodeText(node)).join("");
  }
  if (value.nodeType === 3) {
    return value.data;
  }
  return value.childNodes.map((node) => getNodeText(node)).join("");
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

function firstByClass(value: MinimalNode | readonly MinimalNode[], className: string): MinimalElement {
  const match = findByClass(value, className)[0];
  if (match === undefined) {
    throw new Error(`expected element with class ${className}`);
  }
  return match;
}

describe("StdVisualLayer", () => {
  const harnesses: VisualLayerHarness[] = [];

  beforeEach(() => {
    installMinimalDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const harness of harnesses.splice(0)) {
      harness.unmount();
    }
    vi.useRealTimers();
    uninstallMinimalDom();
  });

  it("renders background and sprite image assets", () => {
    const harness = mountVisualLayer({
      background: { assetId: "classroom" },
      sprites: { mio_smile: { position: "center" } },
      backgroundAssets: { classroom: "/assets/images/classroom.svg" },
      spriteAssets: { mio_smile: { src: "/assets/images/mio_smile.svg", alt: "Mio" } },
    });
    harnesses.push(harness);

    const background = firstByClass(harness.root.childNodes, "tzr-tsuzuru-game__background");
    const sprite = firstByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite");

    expect(background.localName).toBe("img");
    expect(background.getAttribute("src")).toBe("/assets/images/classroom.svg");
    expect(sprite.localName).toBe("img");
    expect(sprite.getAttribute("src")).toBe("/assets/images/mio_smile.svg");
    expect(sprite.getAttribute("alt")).toBe("Mio");
  });

  it("renders placeholder labels when assets are missing", () => {
    const harness = mountVisualLayer({
      background: { assetId: "classroom" },
      sprites: { mio_smile: { position: "left" } },
    });
    harnesses.push(harness);

    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background-placeholder")).toHaveLength(1);
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite-placeholder")).toHaveLength(1);
    expect(getNodeText(harness.root.childNodes)).toContain("classroom");
    expect(getNodeText(harness.root.childNodes)).toContain("mio_smile");
  });

  it("does not animate background transition on initial mount", () => {
    const harness = mountVisualLayer({
      background: { assetId: "classroom", transition: { effect: "fade", durationMs: 240 } },
      backgroundAssets: { classroom: "/assets/images/classroom.svg" },
    });
    harnesses.push(harness);

    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous")).toHaveLength(0);
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--transition-incoming")).toHaveLength(0);
  });

  it("renders previous and current background layers for a valid background change", () => {
    const harness = mountVisualLayer({
      background: { assetId: "classroom" },
      backgroundAssets: {
        classroom: "/assets/images/classroom.svg",
        hallway: "/assets/images/hallway.svg",
      },
    });
    harnesses.push(harness);

    harness.update({
      background: {
        assetId: "hallway",
        transition: { effect: "slide", durationMs: 300, direction: "left", color: "#111827" },
      },
      backgroundAssets: {
        classroom: "/assets/images/classroom.svg",
        hallway: "/assets/images/hallway.svg",
      },
    });

    const previous = firstByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous");
    const current = firstByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--current");

    expect(previous.getAttribute("src")).toBe("/assets/images/classroom.svg");
    expect(previous.className).toContain("tzr-tsuzuru-game__background--transition-outgoing");
    expect(current.getAttribute("src")).toBe("/assets/images/hallway.svg");
    expect(current.className).toContain("tzr-tsuzuru-game__background--transition-slide");
    expect(current.className).toContain("tzr-tsuzuru-game__background--direction-left");
    expect(current.style.getPropertyValue("--tzr-visual-transition-duration")).toBe("300ms");
    expect(current.style.getPropertyValue("--tzr-visual-transition-color")).toBe("#111827");
  });

  it("does not animate same background, cut transitions, or non-positive durations", () => {
    const harness = mountVisualLayer({ background: { assetId: "classroom" } });
    harnesses.push(harness);

    harness.update({ background: { assetId: "classroom", transition: { effect: "fade", durationMs: 300 } } });
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous")).toHaveLength(0);

    harness.update({ background: { assetId: "hallway", transition: { effect: "cut", durationMs: 300 } } });
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous")).toHaveLength(0);

    harness.update({ background: { assetId: "library", transition: { effect: "fade", durationMs: 0 } } });
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous")).toHaveLength(0);
  });

  it("removes the previous background layer after the transition duration", () => {
    const harness = mountVisualLayer({ background: { assetId: "classroom" } });
    harnesses.push(harness);

    harness.update({ background: { assetId: "hallway", transition: { effect: "fade", durationMs: 120 } } });
    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous")).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__background--previous")).toHaveLength(0);
  });

  it("applies sprite transition classes only after initial mount", () => {
    const harness = mountVisualLayer({
      sprites: { mio_smile: { position: "center", transition: { type: "fade", durationMs: 200 } } },
    });
    harnesses.push(harness);

    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite--transition-fade")).toHaveLength(0);

    harness.update({
      sprites: {
        mio_smile: { position: "center", transition: { type: "fade", durationMs: 200 } },
        mio_angry: { position: "right", transition: { type: "dissolve", durationMs: 180 } },
      },
    });

    const sprite = firstByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite--transition-dissolve");
    expect(sprite.style.getPropertyValue("--tzr-visual-transition-duration")).toBe("180ms");

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(findByClass(harness.root.childNodes, "tzr-tsuzuru-game__sprite--transition-dissolve")).toHaveLength(0);
  });
});
