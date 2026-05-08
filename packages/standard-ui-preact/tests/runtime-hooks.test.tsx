import type { RuntimeEvent } from "@tsuzuru/core";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AutoModeState,
  type MessageHistoryEvent,
  type MessageHistoryState,
  type UseAutoModeOptions,
  type UseMessageHistoryOptions,
  useAutoMode,
  useMessageHistory,
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

interface AutoModeHarnessProps {
  readonly options: UseAutoModeOptions;
  readonly onRender: (state: AutoModeState) => void;
}

interface MessageHistoryHarnessProps {
  readonly options: UseMessageHistoryOptions;
  readonly onRender: (state: MessageHistoryState) => void;
}

const narrationEvent = {
  type: "narration",
  lines: [{ text: "The station clock chimed." }],
} satisfies MessageHistoryEvent;

const dialogueEvent = {
  type: "dialogue",
  speaker: "mio",
  lines: [{ text: "遅いよ。" }, { text: "待った？" }],
} satisfies MessageHistoryEvent;

function AutoModeHarness({ options, onRender }: AutoModeHarnessProps): null {
  onRender(useAutoMode(options));
  return null;
}

function MessageHistoryHarness({ options, onRender }: MessageHistoryHarnessProps): null {
  onRender(useMessageHistory(options));
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

async function flushUpdates(): Promise<void> {
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

describe("runtime hooks", () => {
  const roots: MinimalElement[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    installMinimalDom();
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

  async function mountAutoMode(options: UseAutoModeOptions): Promise<{
    readonly getState: () => AutoModeState;
    readonly update: (nextOptions: UseAutoModeOptions) => Promise<void>;
    readonly unmount: () => void;
  }> {
    let currentState: AutoModeState | null = null;
    const root = createMinimalElement("div");
    roots.push(root);

    const update = async (nextOptions: UseAutoModeOptions) => {
      await act(async () => {
        render(
          h(AutoModeHarness, {
            options: nextOptions,
            onRender: (state) => {
              currentState = state;
            },
          }),
          root as unknown as Element,
        );
      });
      await flushUpdates();
    };

    await update(options);

    return {
      getState: () => {
        if (currentState === null) {
          throw new Error("auto mode harness did not render");
        }
        return currentState;
      },
      update,
      unmount: () => {
        act(() => {
          render(null, root as unknown as Element);
        });
      },
    };
  }

  async function mountMessageHistory(options: UseMessageHistoryOptions): Promise<{
    readonly getState: () => MessageHistoryState;
    readonly update: (nextOptions: UseMessageHistoryOptions) => Promise<void>;
  }> {
    let currentState: MessageHistoryState | null = null;
    const root = createMinimalElement("div");
    roots.push(root);

    const update = async (nextOptions: UseMessageHistoryOptions) => {
      await act(async () => {
        render(
          h(MessageHistoryHarness, {
            options: nextOptions,
            onRender: (state) => {
              currentState = state;
            },
          }),
          root as unknown as Element,
        );
      });
      await flushUpdates();
    };

    await update(options);

    return {
      getState: () => {
        if (currentState === null) {
          throw new Error("message history harness did not render");
        }
        return currentState;
      },
      update,
    };
  }

  describe("useAutoMode", () => {
    it("does not advance while disabled", async () => {
      const onAdvance = vi.fn();
      await mountAutoMode({ canAdvance: true, onAdvance, delayMs: 50 });

      await advanceTimersByTime(50);

      expect(onAdvance).not.toHaveBeenCalled();
    });

    it("advances after the delay while enabled and advanceable", async () => {
      const onAdvance = vi.fn();
      const harness = await mountAutoMode({ canAdvance: true, onAdvance, delayMs: 50 });

      act(() => {
        harness.getState().setEnabled(true);
      });
      await flushUpdates();
      await advanceTimersByTime(49);
      expect(onAdvance).not.toHaveBeenCalled();

      await advanceTimersByTime(1);
      expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it("does not advance when canAdvance is false", async () => {
      const onAdvance = vi.fn();
      const harness = await mountAutoMode({ canAdvance: false, onAdvance, delayMs: 50 });

      act(() => {
        harness.getState().setEnabled(true);
      });
      await flushUpdates();
      await advanceTimersByTime(50);

      expect(onAdvance).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("clears the pending timer on unmount", async () => {
      const onAdvance = vi.fn();
      const harness = await mountAutoMode({ canAdvance: true, onAdvance, delayMs: 50 });

      act(() => {
        harness.getState().setEnabled(true);
      });
      await flushUpdates();
      expect(vi.getTimerCount()).toBe(1);

      harness.unmount();
      await flushUpdates();
      await advanceTimersByTime(50);

      expect(vi.getTimerCount()).toBe(0);
      expect(onAdvance).not.toHaveBeenCalled();
    });

    it("uses the latest onAdvance callback", async () => {
      const firstAdvance = vi.fn();
      const secondAdvance = vi.fn();
      const harness = await mountAutoMode({ canAdvance: true, onAdvance: firstAdvance, delayMs: 50 });

      act(() => {
        harness.getState().setEnabled(true);
      });
      await flushUpdates();
      await harness.update({ canAdvance: true, onAdvance: secondAdvance, delayMs: 50 });
      await advanceTimersByTime(50);

      expect(firstAdvance).not.toHaveBeenCalled();
      expect(secondAdvance).toHaveBeenCalledTimes(1);
    });
  });

  describe("useMessageHistory", () => {
    it("adds narration to history", async () => {
      const harness = await mountMessageHistory({ event: narrationEvent, eventKey: "message:1" });

      expect(harness.getState().entries).toEqual([
        {
          id: 1,
          kind: "narration",
          speakerName: null,
          text: "The station clock chimed.",
        },
      ]);
    });

    it("adds dialogue to history", async () => {
      const harness = await mountMessageHistory({ event: dialogueEvent, eventKey: "message:1" });

      expect(harness.getState().entries).toEqual([
        {
          id: 1,
          kind: "dialogue",
          speakerName: "mio",
          text: "遅いよ。\n待った？",
        },
      ]);
    });

    it("does not add duplicate entries for the same eventKey", async () => {
      const harness = await mountMessageHistory({ event: narrationEvent, eventKey: "message:1" });

      await harness.update({ event: dialogueEvent, eventKey: "message:1" });

      expect(harness.getState().entries).toHaveLength(1);
      expect(harness.getState().entries[0]?.text).toBe("The station clock chimed.");
    });

    it("clears entries and resets the next id", async () => {
      const harness = await mountMessageHistory({ event: narrationEvent, eventKey: "message:1" });

      act(() => {
        harness.getState().clear();
      });
      await flushUpdates();
      expect(harness.getState().entries).toEqual([]);

      await harness.update({ event: dialogueEvent, eventKey: "message:2" });

      expect(harness.getState().entries).toEqual([
        {
          id: 1,
          kind: "dialogue",
          speakerName: "mio",
          text: "遅いよ。\n待った？",
        },
      ]);
    });

    it("does not add unsupported events or null", async () => {
      const unsupportedEvent = { type: "waitClick" } satisfies RuntimeEvent;
      const harness = await mountMessageHistory({ event: null, eventKey: "none" });

      await harness.update({ event: unsupportedEvent, eventKey: "wait" });

      expect(harness.getState().entries).toEqual([]);
    });
  });
});
