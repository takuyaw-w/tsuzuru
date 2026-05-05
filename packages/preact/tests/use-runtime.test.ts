import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, isValidElement, render, type ComponentChildren, type VNode } from "preact";
import { act } from "preact/test-utils";
import {
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  stepRuntime,
  type RuntimeDocument,
  type RuntimeEvent,
  type RuntimeSnapshot,
} from "@tsuzuru/core";
import {
  createRuntimeSaveData,
  getAutoClearWaitDuration,
  getRenderableRuntimeEvent,
  isAutoSteppableRuntimeEvent,
  isRenderableRuntimeEvent,
  isRuntimeSaveData,
  isTransientRuntimeEvent,
  restoreRuntimeSnapshotForView,
  RuntimeView,
  useRuntime,
  type UseRuntimeOptions,
  type UseRuntimeResult,
} from "../src/index.js";

const snapshot: RuntimeSnapshot = {
  version: 1,
  pointer: {
    filePath: "scenario/main.tzr",
    instructionIndex: 1,
  },
  variables: {},
  flags: {},
  plugins: {},
  branchFrames: [],
  pendingChoice: null,
  pendingWait: null,
  isStopped: false,
  isWaitingForClick: false,
};

function compileScript(source: string): RuntimeDocument {
  const parsed = parseTzr(source, { filePath: "scenario/main.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  const compiled = compileTzr(parsed.document);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }

  return compiled.document;
}

function expectVNode(value: ComponentChildren): VNode {
  expect(isValidElement(value)).toBe(true);
  if (!isValidElement(value)) {
    throw new Error("expected VNode");
  }

  return value;
}

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
  return index === -1 ? null : siblings[index + 1] ?? null;
}

interface MinimalDocument {
  readonly documentElement: MinimalElement;
  createElementNS(namespaceURI: string, localName: string): MinimalElement;
  createTextNode(data: string): MinimalText;
}

function createMinimalDocument(): MinimalDocument {
  return {
    documentElement: createMinimalElement("html"),
    createElementNS: (namespaceURI, localName) => createMinimalElement(localName, namespaceURI),
    createTextNode: createMinimalText,
  };
}

interface RuntimeHarnessProps {
  readonly document: RuntimeDocument;
  readonly options?: UseRuntimeOptions;
  readonly onRender: (runtime: UseRuntimeResult) => void;
}

function RuntimeHarness({ document, options, onRender }: RuntimeHarnessProps): null {
  const runtime = useRuntime(document, options);
  onRender(runtime);
  return null;
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

async function flushTimersAndUpdates(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
  });
}

async function flushUpdates(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("runtime event classification", () => {
  it("allows non-blocking runtime events to auto-step", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "scene", id: "prologue" },
      { type: "state", command: "set", name: "route", value: "mio" },
      { type: "jump", sceneId: "afterChoice", instructionIndex: 12 },
      { type: "choiceResolve", itemIndex: 0, text: "Stay", id: "stay" },
      { type: "pluginCommand", name: "bg" },
    ];

    for (const event of events) {
      expect(isAutoSteppableRuntimeEvent(event), event.type).toBe(true);
    }
  });

  it("does not auto-step blocking or inspectable runtime events", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "narration", lines: [{ text: "The classroom was quiet." }] },
      { type: "dialogue", speaker: "haruka", lines: [{ text: "You came." }] },
      { type: "choice", question: "Choose", items: [{ id: "stay", text: "Stay" }] },
      { type: "waitClick" },
      { type: "page" },
      { type: "wait", durationMs: 500 },
      { type: "stop" },
      { type: "end" },
      { type: "unsupported", instructionType: "CommandInstruction" },
      { type: "error", code: "choice_index_out_of_range", message: "Choice index 1 is out of range." },
    ];

    for (const event of events) {
      expect(isAutoSteppableRuntimeEvent(event), event.type).toBe(false);
      expect(isRenderableRuntimeEvent(event), event.type).toBe(true);
      expect(getRenderableRuntimeEvent(event)).toBe(event);
    }
  });

  it("recurses through if events for auto-step and rendering", () => {
    const nestedDialogue: RuntimeEvent = {
      type: "dialogue",
      speaker: "haruka",
      lines: [{ text: "You came." }],
    };
    const renderableIf: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: nestedDialogue,
    };
    const transientIf: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "state", command: "set", name: "route", value: "mio" },
    };

    expect(isAutoSteppableRuntimeEvent(renderableIf)).toBe(false);
    expect(getRenderableRuntimeEvent(renderableIf)).toBe(nestedDialogue);
    expect(isAutoSteppableRuntimeEvent(transientIf)).toBe(true);
    expect(getRenderableRuntimeEvent(transientIf)).toBeNull();
    expect(isTransientRuntimeEvent(transientIf)).toBe(true);
  });
});

describe("getAutoClearWaitDuration", () => {
  it("returns the wait duration for a nested wait event from an if event", () => {
    const state = {
      ...snapshot,
      pendingWait: { durationMs: 500 },
    };
    const event: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "wait", durationMs: 500 },
    };

    expect(getAutoClearWaitDuration(event, state, true)).toBe(500);
  });

  it("does not auto-clear when disabled or not waiting", () => {
    const state = {
      ...snapshot,
      pendingWait: { durationMs: 500 },
    };

    expect(getAutoClearWaitDuration({ type: "wait", durationMs: 500 }, state, false)).toBeNull();
    expect(getAutoClearWaitDuration({ type: "waitClick" }, state, true)).toBeNull();
  });
});

describe("useRuntime", () => {
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

  async function mountRuntime(
    document: RuntimeDocument,
    options: UseRuntimeOptions,
  ): Promise<() => UseRuntimeResult> {
    let currentRuntime: UseRuntimeResult | null = null;
    const root = createMinimalElement("div");
    roots.push(root);

    await act(async () => {
      render(
        h(RuntimeHarness, {
          document,
          options,
          onRender: (runtime) => {
            currentRuntime = runtime;
          },
        }),
        root as unknown as Element,
      );
    });
    await flushTimersAndUpdates();

    return () => {
      if (currentRuntime === null) {
        throw new Error("runtime harness did not render");
      }
      return currentRuntime;
    };
  }

  it("stops auto-step at narration and dialogue events from a DSL v2 document", async () => {
    const document = compileScript(`character haruka name="Haruka"
scene start:
  narration:
    The classroom was quiet.
  haruka:
    You came.
`);
    const runtime = await mountRuntime(document, { autoStepTransientEvents: true });

    await act(async () => {
      runtime().step();
    });
    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({
      type: "narration",
      lines: [{ text: "The classroom was quiet." }],
    });
    expect(runtime().visibleEvent).toMatchObject({ type: "narration" });

    await act(async () => {
      runtime().step();
    });
    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({
      type: "dialogue",
      speaker: "haruka",
      lines: [{ text: "You came." }],
    });
    expect(runtime().visibleEvent).toMatchObject({ type: "dialogue" });
  });

  it("stops auto-step at DSL v2 body choices and resolves selected item bodies", async () => {
    const document = compileScript(`scene start:
  choice "What do you do?":
    "Stay" id=stay:
      narration:
        Stayed.
    "Leave" id=leave:
      narration:
        Left.
`);
    const runtime = await mountRuntime(document, { autoStepTransientEvents: true });

    await act(async () => {
      runtime().step();
    });
    await flushTimersAndUpdates();

    expect(runtime().event).toEqual({
      type: "choice",
      question: "What do you do?",
      items: [
        { id: "stay", text: "Stay" },
        { id: "leave", text: "Leave" },
      ],
    });
    expect(runtime().blockReason).toBe("choice");

    await act(async () => {
      runtime().choose(0);
    });
    await flushUpdates();

    expect(runtime().event).toMatchObject({
      type: "narration",
      lines: [{ text: "Stayed." }],
    });
    expect(runtime().blockReason).toBeNull();
  });

  it("creates and restores runtime save data", async () => {
    const document = compileScript(`scene start:
  narration:
    The classroom was quiet.
`);
    const runtime = await mountRuntime(document, {});

    await act(async () => {
      runtime().step();
    });
    await flushUpdates();
    await act(async () => {
      runtime().step();
    });
    await flushUpdates();

    const saveData = runtime().createSaveData();
    expect(isRuntimeSaveData(saveData)).toBe(true);
    expect(saveData.event).toMatchObject({ type: "narration" });
  });
});

describe("restoreRuntimeSnapshotForView", () => {
  it("restores a wait event from a pendingWait snapshot", () => {
    const document = compileScript(`scene start:
  narration:
    Ready.
`);
    const result = restoreRuntimeSnapshotForView(document, {
      ...snapshot,
      pendingWait: { durationMs: 500 },
    });

    expect(result.event).toEqual({ type: "wait", durationMs: 500 });
  });

  it("restores a choice event from a pendingChoice snapshot without advancing state", () => {
    const document = compileScript(`scene start:
  narration:
    Ready.
`);
    const choiceSnapshot: RuntimeSnapshot = {
      ...snapshot,
      pendingChoice: {
        kind: "body",
        question: "Choose",
        items: [{ id: "stay", text: "Stay", body: [] }],
      },
    };

    const result = restoreRuntimeSnapshotForView(document, choiceSnapshot);

    expect(result.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [{ id: "stay", text: "Stay" }],
    });
    expect(result.state.pendingChoice).toEqual(choiceSnapshot.pendingChoice);
  });
});

describe("RuntimeView", () => {
  it("renders narration text", () => {
    const node = expectVNode(
      RuntimeView({
        event: { type: "narration", lines: [{ text: "The classroom was quiet." }] },
      }),
    );

    const children = node.props.children as VNode[];
    expect(children[0]?.props.children).toBe("The classroom was quiet.");
  });

  it("renders choice labels without target metadata", () => {
    const onChoice = vi.fn();
    const node = expectVNode(
      RuntimeView({
        event: {
          type: "choice",
          question: "Choose",
          items: [{ id: "stay", text: "Stay" }],
        },
        onChoice,
      }),
    );

    const children = node.props.children as VNode[];
    const choiceList = children[1];
    if (choiceList === undefined) {
      throw new Error("expected choice list");
    }
    const choiceItems = choiceList.props.children as VNode[];
    const firstItem = choiceItems[0];
    if (firstItem === undefined || !isValidElement(firstItem.props.children)) {
      throw new Error("expected first choice item");
    }
    expect(children[0]?.props.children).toBe("Choose");
    expect(firstItem.props.children.props.children).toBe("Stay");
  });
});

describe("runtime save data helpers", () => {
  it("accepts save data with null event or runtime event", () => {
    expect(isRuntimeSaveData(createRuntimeSaveData(snapshot, null))).toBe(true);
    expect(isRuntimeSaveData(createRuntimeSaveData(snapshot, { type: "scene", id: "start" }))).toBe(true);
  });

  it("round-trips snapshots produced by the shared runtime", () => {
    const document = compileScript(`scene start:
  narration:
    Ready.
`);
    const stepped = stepRuntime(document, createInitialRuntimeState(document));
    const created = createRuntimeSnapshot(stepped.state);
    const saveData = createRuntimeSaveData(created, stepped.event);

    expect(isRuntimeSaveData(saveData)).toBe(true);
  });
});
