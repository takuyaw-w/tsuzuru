import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type TextRevealState, type UseTextRevealOptions, useTextReveal } from "../src/index.js";

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

interface RevealHarnessProps {
  readonly text: string;
  readonly options?: UseTextRevealOptions;
  readonly onRender: (state: TextRevealState) => void;
}

function RevealHarness({ text, options, onRender }: RevealHarnessProps): null {
  onRender(useTextReveal(text, options));
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

describe("useTextReveal", () => {
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

  async function mountReveal(
    text: string,
    options?: UseTextRevealOptions,
  ): Promise<{
    readonly getState: () => TextRevealState;
    readonly getRenderedStates: () => readonly TextRevealState[];
    readonly update: (nextText: string, nextOptions?: UseTextRevealOptions) => Promise<void>;
    readonly unmount: () => void;
  }> {
    let currentState: TextRevealState | null = null;
    const renderedStates: TextRevealState[] = [];
    const root = createMinimalElement("div");
    roots.push(root);

    const update = async (nextText: string, nextOptions?: UseTextRevealOptions) => {
      await act(async () => {
        render(
          h(RevealHarness, {
            text: nextText,
            ...(nextOptions === undefined ? {} : { options: nextOptions }),
            onRender: (state) => {
              currentState = state;
              renderedStates.push(state);
            },
          }),
          root as unknown as Element,
        );
      });
      await flushUpdates();
    };

    await update(text, options);

    return {
      getState: () => {
        if (currentState === null) {
          throw new Error("reveal harness did not render");
        }
        return currentState;
      },
      getRenderedStates: () => renderedStates,
      update,
      unmount: () => {
        act(() => {
          render(null, root as unknown as Element);
        });
      },
    };
  }

  it("starts with no visible text while enabled", async () => {
    const harness = await mountReveal("abc");

    expect(harness.getState().visibleText).toBe("");
    expect(harness.getState().isComplete).toBe(false);
    expect(harness.getState().isRevealing).toBe(true);
  });

  it("reveals characters over time", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 10 });

    await advanceTimersByTime(100);
    expect(harness.getState().visibleText).toBe("a");
    expect(harness.getState().isRevealing).toBe(true);

    await advanceTimersByTime(100);
    expect(harness.getState().visibleText).toBe("ab");
    expect(harness.getState().isComplete).toBe(false);
  });

  it("resets when text changes", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 10 });

    await advanceTimersByTime(100);
    expect(harness.getState().visibleText).toBe("a");

    await harness.update("xyz", { charactersPerSecond: 10 });
    expect(harness.getState().visibleText).toBe("");
    expect(harness.getState().isComplete).toBe(false);
    expect(harness.getState().isRevealing).toBe(true);
  });

  it("does not expose stale visible text during the render that changes text and resetKey", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 10, resetKey: "message-1" });

    act(() => {
      harness.getState().revealAll();
    });
    await flushUpdates();
    expect(harness.getState().visibleText).toBe("abc");

    const firstUpdateRenderIndex = harness.getRenderedStates().length;
    await harness.update("xyz", { charactersPerSecond: 10, resetKey: "message-2" });
    const updateVisibleTexts = harness
      .getRenderedStates()
      .slice(firstUpdateRenderIndex)
      .map((state) => state.visibleText);

    expect(updateVisibleTexts[0]).toBe("");
    expect(updateVisibleTexts).not.toContain("xyz");
    expect(harness.getState().visibleText).toBe("");
  });

  it("resets when resetKey changes even if text is unchanged", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 10, resetKey: "message-1" });

    await advanceTimersByTime(100);
    expect(harness.getState().visibleText).toBe("a");

    await harness.update("abc", { charactersPerSecond: 10, resetKey: "message-2" });
    expect(harness.getState().visibleText).toBe("");
    expect(harness.getState().isComplete).toBe(false);
    expect(harness.getState().isRevealing).toBe(true);
  });

  it("ignores stale timeout callbacks after text and resetKey change", async () => {
    const onCharacterReveal = vi.fn();
    const scheduledCallbacks: Array<() => void> = [];
    const originalSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, timeout, ...args) => {
      if (typeof handler === "function") {
        scheduledCallbacks.push(() => {
          handler(...args);
        });
      }
      return originalSetTimeout(handler, timeout, ...args);
    });

    try {
      const harness = await mountReveal("ab", {
        charactersPerSecond: 10,
        resetKey: "message-1",
        onCharacterReveal,
      });
      const staleCallback = scheduledCallbacks[0];
      if (staleCallback === undefined) {
        throw new Error("expected a scheduled reveal callback");
      }

      await harness.update("xy", {
        charactersPerSecond: 10,
        resetKey: "message-2",
        onCharacterReveal,
      });

      act(() => {
        staleCallback();
      });
      await flushUpdates();

      expect(onCharacterReveal).not.toHaveBeenCalled();
      expect(harness.getState().visibleText).toBe("");

      await advanceTimersByTime(100);
      expect(onCharacterReveal).toHaveBeenCalledTimes(1);
      expect(onCharacterReveal).toHaveBeenCalledWith({ character: "x", index: 0, text: "xy" });
      expect(harness.getState().visibleText).toBe("x");
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it("revealAll shows full text", async () => {
    const harness = await mountReveal("abc");

    act(() => {
      harness.getState().revealAll();
    });
    await flushUpdates();

    expect(harness.getState().visibleText).toBe("abc");
    expect(harness.getState().isComplete).toBe(true);
    expect(harness.getState().isRevealing).toBe(false);
  });

  it("revealAll calls onComplete only once", async () => {
    const onComplete = vi.fn();
    const harness = await mountReveal("abc", { onComplete });

    act(() => {
      harness.getState().revealAll();
    });
    await flushUpdates();

    act(() => {
      harness.getState().revealAll();
    });
    await flushUpdates();

    expect(harness.getState().visibleText).toBe("abc");
    expect(onComplete).toHaveBeenCalledTimes(1);

    await advanceTimersByTime(1000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reset returns to the initial reveal state", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 10 });

    await advanceTimersByTime(100);
    expect(harness.getState().visibleText).toBe("a");

    act(() => {
      harness.getState().reset();
    });
    await flushUpdates();

    expect(harness.getState().visibleText).toBe("");
    expect(harness.getState().isComplete).toBe(false);
    expect(harness.getState().isRevealing).toBe(true);
  });

  it("reset resets completion state", async () => {
    const onComplete = vi.fn();
    const harness = await mountReveal("ab", { charactersPerSecond: 10, onComplete });

    act(() => {
      harness.getState().revealAll();
    });
    await flushUpdates();
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => {
      harness.getState().reset();
    });
    await flushUpdates();

    expect(harness.getState().visibleText).toBe("");
    expect(harness.getState().isComplete).toBe(false);
    expect(harness.getState().isRevealing).toBe(true);

    await advanceTimersByTime(100);
    await advanceTimersByTime(100);

    expect(harness.getState().visibleText).toBe("ab");
    expect(harness.getState().isComplete).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("shows full text when disabled", async () => {
    const harness = await mountReveal("abc", { enabled: false });

    expect(harness.getState().visibleText).toBe("abc");
    expect(harness.getState().isComplete).toBe(true);
    expect(harness.getState().isRevealing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows full text when charactersPerSecond <= 0", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 0 });

    expect(harness.getState().visibleText).toBe("abc");
    expect(harness.getState().isComplete).toBe(true);
    expect(harness.getState().isRevealing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("calls onCharacterReveal for each revealed character", async () => {
    const onCharacterReveal = vi.fn();
    const harness = await mountReveal("ab", { charactersPerSecond: 10, onCharacterReveal });

    await advanceTimersByTime(100);

    expect(harness.getState().visibleText).toBe("a");
    expect(onCharacterReveal).toHaveBeenCalledWith({ character: "a", index: 0, text: "ab" });
  });

  it("calls onComplete when all text has been revealed", async () => {
    const onComplete = vi.fn();
    const harness = await mountReveal("ab", { charactersPerSecond: 10, onComplete });

    await advanceTimersByTime(100);
    await advanceTimersByTime(100);

    expect(harness.getState().visibleText).toBe("ab");
    expect(harness.getState().isComplete).toBe(true);
    expect(harness.getState().isRevealing).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);

    await advanceTimersByTime(100);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not call onComplete again when revealAll is called after natural completion", async () => {
    const onComplete = vi.fn();
    const harness = await mountReveal("ab", { charactersPerSecond: 10, onComplete });

    await advanceTimersByTime(100);
    await advanceTimersByTime(100);
    act(() => {
      harness.getState().revealAll();
    });
    await flushUpdates();

    expect(harness.getState().visibleText).toBe("ab");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("cleans up pending timers on unmount", async () => {
    const harness = await mountReveal("abc", { charactersPerSecond: 10 });

    expect(vi.getTimerCount()).toBe(1);

    harness.unmount();
    await flushUpdates();

    expect(vi.getTimerCount()).toBe(0);
  });
});
