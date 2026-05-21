import {
  type CompiledTzrDocument,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  prepareRuntimeStateForSnapshot,
  restoreRuntimeState,
  stepRuntime,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdTransitionCommandHandlers,
  createStdTransitionPlugin,
  getStdTransitionState,
  prepareStdTransitionStateForSnapshot,
} from "../src/index.js";

const filePath = "scenario/std-transition-save-load.tzr";

describe("std transition save/load integration", () => {
  it("clears one-shot transition events before save and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  transition fade(duration=500)
  transition wipe(direction="left", duration=600)
  narration:
    After transitions.
`);
    const commandHandlers = createStdTransitionCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdTransitionPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const fade = stepRuntime(document, scene.state, { commandHandlers });
    const wipe = stepRuntime(document, fade.state, { commandHandlers });

    expect(getStdTransitionState(fade.state)).toEqual({
      events: [{ sequence: 1, effect: "fade", durationMs: 500, color: "#000000" }],
      nextSequence: 2,
    });
    expect(getStdTransitionState(wipe.state)).toEqual({
      events: [
        { sequence: 1, effect: "fade", durationMs: 500, color: "#000000" },
        { sequence: 2, effect: "wipe", durationMs: 600, direction: "left" },
      ],
      nextSequence: 3,
    });

    const saveReadyState = prepareRuntimeStateForSnapshot(wipe.state, [prepareStdTransitionStateForSnapshot]);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(saveReadyState)));

    expect(getStdTransitionState(saveReadyState)).toEqual({
      events: [],
      nextSequence: 3,
    });
    expect(restored.pointer).toEqual({ filePath, instructionIndex: 3 });
    expect(getStdTransitionState(restored)).toEqual({
      events: [],
      nextSequence: 3,
    });

    const afterTransitions = stepRuntime(document, restored, { commandHandlers });
    expect(afterTransitions.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After transitions." }],
    });
    expect(getStdTransitionState(afterTransitions.state)).toEqual({
      events: [],
      nextSequence: 3,
    });
  });
});

function compileSource(source: string): CompiledTzrDocument {
  const parsed = parseTzr(source, { filePath });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  const compiled = compileTzr(parsed.document, {
    plugins: [createStdTransitionPlugin()],
  });
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }
  return compiled.document;
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
