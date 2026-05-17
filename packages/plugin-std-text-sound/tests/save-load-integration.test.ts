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
import { createStdTextSoundCommandHandlers, createStdTextSoundPlugin, getStdTextSoundState } from "../src/index.js";

const filePath = "scenario/std-text-sound-save-load.tzr";

describe("std text sound save/load integration", () => {
  it("keeps durable override state across snapshot restore and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  textSound mio
  narration:
    Override active.
  stopTextSound
  narration:
    Done.
`);
    const commandHandlers = createStdTextSoundCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdTextSoundPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const textSound = stepRuntime(document, scene.state, { commandHandlers });

    expect(getStdTextSoundState(textSound.state)).toEqual({ overrideProfileId: "mio" });

    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(textSound.state)));

    expect(restored.pointer).toEqual({ filePath, instructionIndex: 2 });
    expect(getStdTextSoundState(restored)).toEqual({ overrideProfileId: "mio" });

    const overrideActive = stepRuntime(document, restored, { commandHandlers });
    expect(overrideActive.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Override active." }],
    });
    expect(getStdTextSoundState(overrideActive.state)).toEqual(getStdTextSoundState(restored));

    const stopTextSound = stepRuntime(document, overrideActive.state, { commandHandlers });
    expect(getStdTextSoundState(stopTextSound.state)).toEqual({ overrideProfileId: null });

    const done = stepRuntime(document, stopTextSound.state, { commandHandlers });
    expect(done.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Done." }],
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
    plugins: [createStdTextSoundPlugin()],
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
