import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, isValidElement, render, type ComponentChildren, type VNode } from "preact";
import { act } from "preact/test-utils";
import {
  compileTzr,
  createInitialRuntimeState,
  parseTzr,
  stepRuntime,
  type CompiledTzrDocument,
  type RuntimeEvent,
  type RuntimePluginDefinition,
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

function compileScript(source: string): CompiledTzrDocument {
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
  const text: MinimalText = {
    nodeType: 3,
    data,
    parentNode: null,
    get nextSibling() {
      return nextSiblingOf(this);
    },
  };
  return text;
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
  readonly document: CompiledTzrDocument;
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

describe("isAutoSteppableRuntimeEvent", () => {
  it("allows non-blocking runtime events to auto-step", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "scene", id: "prologue" },
      { type: "label", id: "start" },
      { type: "state", command: "flag", name: "met", value: true },
      { type: "jump", label: "after_choice", instructionIndex: 12 },
      { type: "pluginCommand", name: "bg" },
    ];

    for (const event of events) {
      expect(isAutoSteppableRuntimeEvent(event), event.type).toBe(true);
    }
  });

  it("does not auto-step blocking or inspectable runtime events", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "narration", lines: [{ text: "The classroom was quiet." }] },
      { type: "dialogue", speaker: "Haruka", lines: [{ text: "You came." }] },
      {
        type: "choice",
        question: "What do you do?",
        items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
      },
      { type: "waitClick" },
      { type: "page" },
      { type: "wait", durationMs: 500 },
      { type: "stop" },
      { type: "end" },
      { type: "unsupported", instructionType: "MacroInstruction" },
      { type: "error", code: "choice_index_out_of_range", message: "Choice index 1 is out of range." },
    ];

    for (const event of events) {
      expect(isAutoSteppableRuntimeEvent(event), event.type).toBe(false);
    }
  });

  it("allows if events without nested events to auto-step", () => {
    expect(isAutoSteppableRuntimeEvent({ type: "if", result: false, branch: "none" })).toBe(true);
  });

  it("recursively allows if events with auto-steppable nested events", () => {
    const stateEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "state", command: "inc", name: "affection", value: 1 },
    };
    const jumpEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "jump", label: "after_choice", instructionIndex: 20 },
    };
    const nestedIfEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: {
        type: "if",
        result: true,
        branch: "then",
        event: { type: "label", id: "nested" },
      },
    };

    expect(isAutoSteppableRuntimeEvent(stateEvent)).toBe(true);
    expect(isAutoSteppableRuntimeEvent(jumpEvent)).toBe(true);
    expect(isAutoSteppableRuntimeEvent(nestedIfEvent)).toBe(true);
  });

  it("recursively rejects if events with blocking or inspectable nested events", () => {
    const dialogueEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "dialogue", speaker: "Haruka", lines: [{ text: "You came." }] },
    };
    const narrationEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "The classroom was quiet." }] },
    };
    const unsupportedEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: { type: "unsupported", instructionType: "MacroInstruction" },
    };
    const nestedIfEvent: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: {
        type: "if",
        result: true,
        branch: "then",
        event: { type: "narration", lines: [{ text: "Nested narration." }] },
      },
    };

    expect(isAutoSteppableRuntimeEvent(dialogueEvent)).toBe(false);
    expect(isAutoSteppableRuntimeEvent(narrationEvent)).toBe(false);
    expect(isAutoSteppableRuntimeEvent(unsupportedEvent)).toBe(false);
    expect(isAutoSteppableRuntimeEvent(nestedIfEvent)).toBe(false);
  });

  it("keeps the deprecated transient alias compatible", () => {
    const event: RuntimeEvent = { type: "if", result: true, branch: "then" };

    expect(isTransientRuntimeEvent(event)).toBe(isAutoSteppableRuntimeEvent(event));
  });
});

describe("isRenderableRuntimeEvent", () => {
  it("allows blocking or inspectable runtime events to render", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "narration", lines: [{ text: "The classroom was quiet." }] },
      { type: "dialogue", speaker: "Haruka", lines: [{ text: "You came." }] },
      {
        type: "choice",
        question: "What do you do?",
        items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
      },
      { type: "waitClick" },
      { type: "page" },
      { type: "wait", durationMs: 500 },
      { type: "stop" },
      { type: "end" },
      { type: "unsupported", instructionType: "MacroInstruction" },
      { type: "error", code: "choice_index_out_of_range", message: "Choice index 1 is out of range." },
    ];

    for (const event of events) {
      expect(isRenderableRuntimeEvent(event), event.type).toBe(true);
      expect(getRenderableRuntimeEvent(event)).toBe(event);
    }
  });

  it("rejects non-renderable transient runtime events", () => {
    const events: readonly RuntimeEvent[] = [
      { type: "scene", id: "prologue" },
      { type: "label", id: "start" },
      { type: "state", command: "flag", name: "met", value: true },
      { type: "jump", label: "after_choice", instructionIndex: 12 },
      { type: "pluginCommand", name: "bg" },
    ];

    for (const event of events) {
      expect(isRenderableRuntimeEvent(event), event.type).toBe(false);
      expect(getRenderableRuntimeEvent(event)).toBeNull();
    }
  });

  it("uses nested if events only when the nested event is renderable", () => {
    const nestedDialogue: RuntimeEvent = {
      type: "dialogue",
      speaker: "Haruka",
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
      event: { type: "label", id: "start" },
    };

    expect(isRenderableRuntimeEvent(renderableIf)).toBe(true);
    expect(getRenderableRuntimeEvent(renderableIf)).toBe(nestedDialogue);
    expect(isRenderableRuntimeEvent(transientIf)).toBe(false);
    expect(getRenderableRuntimeEvent(transientIf)).toBeNull();
  });

  it("uses a nested wait event from an if event as the renderable event", () => {
    const nestedWait: RuntimeEvent = { type: "wait", durationMs: 500 };
    const event: RuntimeEvent = {
      type: "if",
      result: true,
      branch: "then",
      event: nestedWait,
    };

    expect(isRenderableRuntimeEvent(event)).toBe(true);
    expect(getRenderableRuntimeEvent(event)).toBe(nestedWait);
  });
});

describe("getAutoClearWaitDuration", () => {
  it("returns the wait duration for a nested wait event from an if event", () => {
    const document = compileScript(`@flag("ready")
@if(flag("ready"))
@wait(500)
@endif
`);
    const flagged = stepRuntime(document, createInitialRuntimeState(document));
    const waited = stepRuntime(document, flagged.state);

    expect(waited.event).toMatchObject({
      type: "if",
      event: { type: "wait", durationMs: 500 },
    });
    expect(getRenderableRuntimeEvent(waited.event)).toEqual({ type: "wait", durationMs: 500 });
    expect(waited.state.pendingWait).toEqual({ durationMs: 500 });
    expect(getAutoClearWaitDuration(waited.event, waited.state, true)).toBe(500);
  });

  it("does not auto-clear waitClick, page, or choice events", () => {
    const blockedState = {
      ...snapshot,
      pendingWait: { durationMs: 500 },
    };
    const events: readonly RuntimeEvent[] = [
      { type: "waitClick" },
      { type: "page" },
      {
        type: "choice",
        question: "What do you do?",
        items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
      },
    ];

    for (const event of events) {
      expect(getAutoClearWaitDuration(event, blockedState, true), event.type).toBeNull();
    }
  });

  it("does not auto-clear when autoClearWait is disabled", () => {
    const state = {
      ...snapshot,
      pendingWait: { durationMs: 500 },
    };

    expect(getAutoClearWaitDuration({ type: "wait", durationMs: 500 }, state, false)).toBeNull();
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
    document: CompiledTzrDocument,
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

  it("stops auto-step at narration and dialogue events", async () => {
    const document = compileScript(`#scene("prologue")
The classroom was quiet.
:: Haruka
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

    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({ type: "narration" });

    await act(async () => {
      runtime().step();
    });
    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({
      type: "dialogue",
      speaker: "Haruka",
      lines: [{ text: "You came." }],
    });
    expect(runtime().visibleEvent).toMatchObject({ type: "dialogue" });

    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({ type: "dialogue" });
  });

  it("stops auto-step at choice events", async () => {
    const document = compileScript(`#scene("prologue")
? What do you do?
- "Stay" -> #stay
#label("stay")
`);
    const runtime = await mountRuntime(document, { autoStepTransientEvents: true });

    await act(async () => {
      runtime().step();
    });
    await flushTimersAndUpdates();

    expect(runtime().event).toEqual({
      type: "choice",
      question: "What do you do?",
      items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
    });
    expect(runtime().visibleEvent).toEqual(runtime().event);
    expect(runtime().blockReason).toBe("choice");

    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({ type: "choice" });
    expect(runtime().blockReason).toBe("choice");
  });

  it("stops auto-step when autoStepMaxSteps is reached", async () => {
    const document = compileScript('#label("loop")\n@jump("#loop")\n');
    const runtime = await mountRuntime(document, {
      autoStepTransientEvents: true,
      autoStepMaxSteps: 2,
    });

    await act(async () => {
      runtime().step();
    });
    for (let index = 0; index < 5; index += 1) {
      await flushTimersAndUpdates();
    }

    expect(runtime().autoStepError).toBe("Auto-step stopped after 2 consecutive runtime events.");
    expect(runtime().isBlocked).toBe(false);
    expect(runtime().state.isStopped).toBe(false);
  });

  it("does not expose transient events as visibleEvent", async () => {
    const document = compileScript(`#scene("prologue")
The classroom was quiet.
`);
    const runtime = await mountRuntime(document, { autoStepTransientEvents: true });

    await act(async () => {
      runtime().step();
    });
    await flushUpdates();

    expect(runtime().event).toEqual({ type: "scene", id: "prologue" });
    expect(runtime().visibleEvent).toBeNull();

    await flushTimersAndUpdates();

    expect(runtime().event).toMatchObject({ type: "narration" });
    expect(runtime().visibleEvent).toMatchObject({ type: "narration" });
  });

  it("initializes registered runtime plugin state", async () => {
    const document = compileScript("The classroom was quiet.\n");
    const plugin: RuntimePluginDefinition<{ readonly ready: true }> = {
      name: "testPlugin",
      createInitialState: () => ({ ready: true }),
    };
    const runtime = await mountRuntime(document, { plugins: [plugin] });

    expect(runtime().state.plugins.testPlugin).toEqual({ ready: true });
  });
});

describe("RuntimeSaveData", () => {
  it("creates save data with version, state-only snapshot, and current event", () => {
    const event: RuntimeEvent = {
      type: "dialogue",
      speaker: "Haruka",
      lines: [{ text: "You came." }],
    };
    const saveData = createRuntimeSaveData(snapshot, event);

    expect(saveData.version).toBe(1);
    expect(saveData.snapshot).toBe(snapshot);
    expect(saveData.event).toBe(event);
    expect("event" in saveData.snapshot).toBe(false);
  });

  it("saves a narration visible event alongside the runtime snapshot", () => {
    const document = compileScript("The classroom was quiet.\n");
    const narration = stepRuntime(document, createInitialRuntimeState(document));
    const saveData = createRuntimeSaveData(
      {
        ...snapshot,
        pointer: narration.state.pointer,
      },
      narration.event,
    );

    expect(saveData.event).toMatchObject({
      type: "narration",
      lines: [{ text: "The classroom was quiet." }],
    });
    expect(isRuntimeSaveData(saveData)).toBe(true);
  });

  it("saves a dialogue visible event alongside the runtime snapshot", () => {
    const document = compileScript(":: Haruka\nYou came.\n");
    const dialogue = stepRuntime(document, createInitialRuntimeState(document));
    const saveData = createRuntimeSaveData(
      {
        ...snapshot,
        pointer: dialogue.state.pointer,
      },
      dialogue.event,
    );

    expect(saveData.event).toMatchObject({
      type: "dialogue",
      speaker: "Haruka",
      lines: [{ text: "You came." }],
    });
    expect(isRuntimeSaveData(saveData)).toBe(true);
  });

  it("accepts valid save data with null event", () => {
    expect(isRuntimeSaveData(createRuntimeSaveData(snapshot, null))).toBe(true);
  });

  it("accepts valid save data with object event", () => {
    expect(isRuntimeSaveData(createRuntimeSaveData(snapshot, { type: "label", id: "start" }))).toBe(
      true,
    );
  });

  it("rejects save data with a mismatched version", () => {
    expect(isRuntimeSaveData({ version: 2, snapshot, event: null })).toBe(false);
  });

  it("rejects save data without a valid snapshot object", () => {
    expect(isRuntimeSaveData({ version: 1, event: null })).toBe(false);
    expect(isRuntimeSaveData({ version: 1, snapshot: null, event: null })).toBe(false);
    expect(isRuntimeSaveData({ version: 1, snapshot: { ...snapshot, version: 2 }, event: null })).toBe(
      false,
    );
    expect(isRuntimeSaveData({ version: 1, snapshot: { ...snapshot, pointer: undefined }, event: null })).toBe(
      false,
    );
    expect(
      isRuntimeSaveData({
        version: 1,
        snapshot: { ...snapshot, pointer: { ...snapshot.pointer, filePath: 1 } },
        event: null,
      }),
    ).toBe(false);
    expect(
      isRuntimeSaveData({
        version: 1,
        snapshot: { ...snapshot, pointer: { ...snapshot.pointer, instructionIndex: "1" } },
        event: null,
      }),
    ).toBe(false);
  });

  it("rejects object events without a string type", () => {
    expect(isRuntimeSaveData({ version: 1, snapshot, event: {} })).toBe(false);
    expect(isRuntimeSaveData({ version: 1, snapshot, event: { type: 1 } })).toBe(false);
  });
});

describe("restoreRuntimeSnapshotForView", () => {
  const document = compileScript("The classroom was quiet.\n");

  it("restores a non-blocking snapshot with a null event", () => {
    const result = restoreRuntimeSnapshotForView(document, snapshot);

    expect(result.state.pointer).toEqual(snapshot.pointer);
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.pendingWait).toBeNull();
    expect(result.state.isWaitingForClick).toBe(false);
    expect(result.event).toBeNull();
  });

  it("restores a choice event from a pendingChoice snapshot without advancing state", () => {
    const choiceSnapshot: RuntimeSnapshot = {
      ...snapshot,
      pendingChoice: {
        question: "What do you do?",
        items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
      },
    };

    const result = restoreRuntimeSnapshotForView(document, choiceSnapshot);

    expect(result.event).toEqual({
      type: "choice",
      question: "What do you do?",
      items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
    });
    expect(result.state.pointer).toEqual(choiceSnapshot.pointer);
    expect(result.state.pendingChoice).toEqual(choiceSnapshot.pendingChoice);
  });

  it("restores a wait event from a pendingWait snapshot without advancing state", () => {
    const waitSnapshot: RuntimeSnapshot = {
      ...snapshot,
      pendingWait: { durationMs: 500 },
    };

    const result = restoreRuntimeSnapshotForView(document, waitSnapshot);

    expect(result.event).toEqual({ type: "wait", durationMs: 500 });
    expect(result.state.pointer).toEqual(waitSnapshot.pointer);
    expect(result.state.pendingWait).toEqual(waitSnapshot.pendingWait);
  });

  it("restores a waitClick event from an isWaitingForClick snapshot without advancing state", () => {
    const waitClickSnapshot: RuntimeSnapshot = {
      ...snapshot,
      isWaitingForClick: true,
    };

    const result = restoreRuntimeSnapshotForView(document, waitClickSnapshot);

    expect(result.event).toEqual({ type: "waitClick" });
    expect(result.state.pointer).toEqual(waitClickSnapshot.pointer);
    expect(result.state.isWaitingForClick).toBe(true);
  });
});

describe("RuntimeView", () => {
  it("makes narration advanceable when onAdvance is enabled", () => {
    const onAdvance = () => undefined;
    const view = expectVNode(
      RuntimeView({
        event: { type: "narration", lines: [{ text: "The classroom was quiet." }] },
        onAdvance,
        canAdvance: true,
      }),
    );
    const props = view.props as Readonly<Record<string, unknown>>;

    expect(props.onAdvance).toBe(onAdvance);
    expect(props.canAdvance).toBe(true);
    expect(props.className).toBe("tzr-runtime-view--narration");
  });

  it("makes dialogue advanceable when onAdvance is enabled", () => {
    const onAdvance = () => undefined;
    const view = expectVNode(
      RuntimeView({
        event: {
          type: "dialogue",
          speaker: "Haruka",
          lines: [{ text: "You came." }],
        },
        onAdvance,
        canAdvance: true,
      }),
    );
    const props = view.props as Readonly<Record<string, unknown>>;

    expect(props.onAdvance).toBe(onAdvance);
    expect(props.canAdvance).toBe(true);
    expect(props.className).toBe("tzr-runtime-view--dialogue");
  });

  it("does not advance from the choice container", () => {
    const onAdvance = () => undefined;
    const view = expectVNode(
      RuntimeView({
        event: {
          type: "choice",
          question: "What do you do?",
          items: [{ text: "Stay", targetRaw: "#stay", targetLabel: "stay" }],
        },
        onAdvance,
        canAdvance: true,
      }),
    );
    const props = view.props as Readonly<Record<string, unknown>>;

    expect(props.onClick).toBeUndefined();
    expect(props.className).toBe("tzr-runtime-view tzr-runtime-view--choice");
  });
});
