import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type StdAudioLayerDiagnostic,
  type StdAudioNoticesState,
  type UseStdAudioNoticesOptions,
  useStdAudioNotices,
} from "../src/index.js";

interface MinimalElement {
  readonly nodeType: 1;
  readonly namespaceURI: string;
  readonly localName: string;
  readonly attributes: readonly [];
  readonly style: Record<string, string>;
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
}

interface NoticeHarnessProps {
  readonly options?: UseStdAudioNoticesOptions | undefined;
  readonly onRender: (state: StdAudioNoticesState) => void;
}

const roots: MinimalElement[] = [];

function NoticeHarness({ options, onRender }: NoticeHarnessProps): null {
  onRender(useStdAudioNotices(options));
  return null;
}

function createMinimalElement(localName: string, namespaceURI = "http://www.w3.org/1999/xhtml"): MinimalElement {
  const element: MinimalElement = {
    nodeType: 1,
    namespaceURI,
    localName,
    attributes: [],
    style: {},
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
    setAttribute() {
      return undefined;
    },
    removeAttribute() {
      return undefined;
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

function createMinimalDocument(): MinimalDocument {
  return {
    documentElement: createMinimalElement("html"),
    createElementNS: (namespaceURI, localName) => createMinimalElement(localName, namespaceURI),
    createTextNode: createMinimalText,
  };
}

function installMinimalDom(): void {
  const minimalDocument = createMinimalDocument();
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

async function mountNotices(options?: UseStdAudioNoticesOptions): Promise<{
  readonly getState: () => StdAudioNoticesState;
  readonly unmount: () => void;
}> {
  const root = createMinimalElement("div");
  roots.push(root);
  let currentState: StdAudioNoticesState | undefined;

  await act(async () => {
    render(
      h(NoticeHarness, {
        ...(options === undefined ? {} : { options }),
        onRender: (state) => {
          currentState = state;
        },
      }),
      root as unknown as Element,
    );
  });
  await flushEffects();

  return {
    getState: () => {
      if (currentState === undefined) {
        throw new Error("notice state was not rendered");
      }
      return currentState;
    },
    unmount: () => {
      act(() => {
        render(null, root as unknown as Element);
      });
    },
  };
}

function createDiagnostic(
  assetId: string,
  message: string,
  code = "standardUi.audioAssetMissing",
): StdAudioLayerDiagnostic {
  return {
    code,
    channel: "BGM",
    assetId,
    message,
  };
}

describe("useStdAudioNotices", () => {
  beforeEach(() => {
    installMinimalDom();
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        render(null, root as unknown as Element);
      });
    }
    uninstallMinimalDom();
  });

  it("deduplicates diagnostics and warns once per diagnostic key", async () => {
    const onWarn = vi.fn();
    const harness = await mountNotices({ onWarn });
    const diagnostic = createDiagnostic("daily_theme", "Missing BGM audio asset.");

    await act(async () => {
      harness.getState().handleAudioDiagnostic(diagnostic);
      harness.getState().handleAudioDiagnostic(diagnostic);
    });
    await flushEffects();

    expect(harness.getState().notices).toEqual(["Missing BGM audio asset."]);
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onWarn).toHaveBeenCalledWith("Missing BGM audio asset.", diagnostic);
  });

  it("keeps the most recent notices up to maxCount", async () => {
    const harness = await mountNotices({ maxCount: 2, onWarn: vi.fn() });

    await act(async () => {
      harness.getState().handleAudioDiagnostic(createDiagnostic("one", "first"));
      harness.getState().handleAudioDiagnostic(createDiagnostic("two", "second"));
      harness.getState().handleAudioDiagnostic(createDiagnostic("three", "third"));
    });
    await flushEffects();

    expect(harness.getState().notices).toEqual(["second", "third"]);
  });
});
