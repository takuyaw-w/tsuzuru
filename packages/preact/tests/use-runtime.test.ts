import { describe, expect, it } from "vitest";
import type { RuntimeEvent, RuntimeSnapshot } from "@tsuzuru/core";
import {
  createRuntimeSaveData,
  isAutoSteppableRuntimeEvent,
  isRuntimeSaveData,
  isTransientRuntimeEvent,
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

  it("rejects save data without a snapshot object", () => {
    expect(isRuntimeSaveData({ version: 1, event: null })).toBe(false);
    expect(isRuntimeSaveData({ version: 1, snapshot: null, event: null })).toBe(false);
  });
});
