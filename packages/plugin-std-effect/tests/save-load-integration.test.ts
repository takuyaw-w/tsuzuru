import {
  type CompiledTzrDocument,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  restoreRuntimeState,
  stepRuntime,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdEffectCommandHandlers,
  createStdEffectPlugin,
  getStdEffectState,
  prepareStdEffectStateForSnapshot,
} from "../src/index.js";

const filePath = "scenario/std-effect-save-load.tzr";

describe("std effect save/load integration", () => {
  it("clears one-shot effect events before save and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  shake screen intensity=strong duration=300
  flash color="#ffffff" duration=120
  narration:
    After effects.
`);
    const commandHandlers = createStdEffectCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdEffectPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const shake = stepRuntime(document, scene.state, { commandHandlers });
    const flash = stepRuntime(document, shake.state, { commandHandlers });

    expect(getStdEffectState(shake.state)).toEqual({
      events: [{ sequence: 1, type: "shake", target: "screen", intensity: "strong", durationMs: 300 }],
      nextSequence: 2,
    });
    expect(getStdEffectState(flash.state)).toEqual({
      events: [
        { sequence: 1, type: "shake", target: "screen", intensity: "strong", durationMs: 300 },
        { sequence: 2, type: "flash", color: "#ffffff", durationMs: 120 },
      ],
      nextSequence: 3,
    });

    const saveReadyState = prepareStdEffectStateForSnapshot(flash.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(saveReadyState)));

    expect(getStdEffectState(saveReadyState)).toEqual({
      events: [],
      nextSequence: 3,
    });
    expect(restored.pointer).toEqual({ filePath, instructionIndex: 3 });
    expect(getStdEffectState(restored)).toEqual({
      events: [],
      nextSequence: 3,
    });

    const afterEffects = stepRuntime(document, restored, { commandHandlers });
    expect(afterEffects.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After effects." }],
    });
    expect(getStdEffectState(afterEffects.state)).toEqual({
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
    plugins: [createStdEffectPlugin()],
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
