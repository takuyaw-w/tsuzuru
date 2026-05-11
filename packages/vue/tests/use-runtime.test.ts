import {
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  type RuntimeDocument,
  type RuntimeEvent,
  type RuntimeSnapshot,
  stepRuntime,
} from "@tsuzuru/core";
import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeSaveData,
  getAutoClearWaitDuration,
  getRenderableRuntimeEvent,
  isAutoSteppableRuntimeEvent,
  isRenderableRuntimeEvent,
  isRuntimeSaveData,
  isTransientRuntimeEvent,
  restoreRuntimeSnapshotForView,
  useRuntime,
  useTsuzuruRuntime,
} from "../src/index.js";

const snapshot: RuntimeSnapshot = {
  version: 2,
  pointer: {
    filePath: "scenario/main.tzr",
    instructionIndex: 1,
  },
  variables: {},
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

describe("runtime event classification", () => {
  it("matches the Preact adapter visible and auto-step event rules", () => {
    const transientEvents: readonly RuntimeEvent[] = [
      { type: "scene", id: "prologue" },
      { type: "state", command: "set", name: "route", value: "mio" },
      { type: "jump", sceneId: "afterChoice", instructionIndex: 12 },
      { type: "choiceResolve", itemIndex: 0, text: "Stay", id: "stay" },
      { type: "pluginCommand", name: "bg" },
    ];

    for (const event of transientEvents) {
      expect(isAutoSteppableRuntimeEvent(event), event.type).toBe(true);
      expect(isTransientRuntimeEvent(event), event.type).toBe(true);
      expect(getRenderableRuntimeEvent(event), event.type).toBeNull();
    }

    const renderableEvents: readonly RuntimeEvent[] = [
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

    for (const event of renderableEvents) {
      expect(isAutoSteppableRuntimeEvent(event), event.type).toBe(false);
      expect(isRenderableRuntimeEvent(event), event.type).toBe(true);
      expect(getRenderableRuntimeEvent(event), event.type).toBe(event);
    }
  });

  it("unwraps renderable nested if events", () => {
    const event: RuntimeEvent = {
      type: "if",
      branch: "then",
      result: true,
      event: { type: "narration", lines: [{ text: "Nested." }] },
    };

    expect(isAutoSteppableRuntimeEvent(event)).toBe(false);
    expect(getRenderableRuntimeEvent(event)).toEqual({ type: "narration", lines: [{ text: "Nested." }] });
  });
});

describe("runtime save helpers", () => {
  it("creates and validates runtime save data", () => {
    const event: RuntimeEvent = { type: "narration", lines: [{ text: "Saved line." }] };
    const saveData = createRuntimeSaveData(snapshot, event);

    expect(saveData).toEqual({ version: 2, snapshot, event });
    expect(isRuntimeSaveData(saveData)).toBe(true);
    expect(isRuntimeSaveData({ version: 1, snapshot, event })).toBe(false);
  });

  it("restores blocked snapshots with the visible blocked event", () => {
    const document = compileScript(`title "Blocked"\n\nscene start:\n  wait 100\n  end\n`);
    const first = stepRuntime(document, stepRuntime(document, createInitialRuntimeState(document)).state);
    expect(first.event.type).toBe("wait");

    const restored = restoreRuntimeSnapshotForView(document, createRuntimeSnapshot(first.state));

    expect(restored.event).toEqual({ type: "wait", durationMs: 100 });
  });
});

describe("useRuntime", () => {
  it("steps through narration and choices using Vue refs", () => {
    const document = compileScript(`
title "Vue Runtime"

scene start:
  narration:
    Hello.
  choice "Next?":
    "Go" id=go:
      narration:
        Went.
      end
`);
    const runtime = useRuntime(document);

    runtime.step();
    expect(runtime.event.value).toEqual({ type: "scene", id: "start" });
    expect(runtime.visibleEvent.value).toBeNull();
    runtime.step();
    expect(runtime.visibleEvent.value?.type).toBe("narration");
    expect(runtime.visibleEvent.value?.type === "narration" ? runtime.visibleEvent.value.lines[0]?.text : null).toBe(
      "Hello.",
    );
    runtime.step();
    expect(runtime.blockReason.value).toBe("choice");
    expect(runtime.visibleEvent.value?.type).toBe("choice");
    runtime.choose(0);
    expect(runtime.event.value?.type).toBe("narration");
    expect(runtime.event.value?.type === "narration" ? runtime.event.value.lines[0]?.text : null).toBe("Went.");

    runtime.destroy();
  });

  it("exposes useTsuzuruRuntime as an alias", () => {
    expect(useTsuzuruRuntime).toBe(useRuntime);
  });

  it("auto-clears timed waits and cleans up timers on destroy", async () => {
    vi.useFakeTimers();
    const document = compileScript(`title "Wait"\n\nscene start:\n  wait 10\n  narration:\n    Done.\n`);
    const runtime = useRuntime(document, { autoClearWait: true });

    runtime.step();
    runtime.step();
    expect(runtime.visibleEvent.value).toEqual({ type: "wait", durationMs: 10 });
    expect(getAutoClearWaitDuration(runtime.event.value, runtime.state.value, true)).toBe(10);

    await vi.runOnlyPendingTimersAsync();
    expect(runtime.event.value?.type).toBe("narration");
    expect(runtime.event.value?.type === "narration" ? runtime.event.value.lines[0]?.text : null).toBe("Done.");

    runtime.destroy();
    vi.useRealTimers();
  });
});
