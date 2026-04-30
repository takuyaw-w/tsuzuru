import { describe, expect, it } from "vitest";
import { isValidElement, type ComponentChildren, type VNode } from "preact";
import {
  compileTzr,
  createInitialRuntimeState,
  parseTzr,
  stepRuntime,
  type CompiledTzrDocument,
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
} from "../src/index.js";

const snapshot: RuntimeSnapshot = {
  version: 1,
  pointer: {
    filePath: "scenario/main.tzr",
    instructionIndex: 1,
  },
  variables: {},
  flags: {},
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
