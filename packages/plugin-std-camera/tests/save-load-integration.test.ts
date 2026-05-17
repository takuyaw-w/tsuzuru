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
import { createStdCameraCommandHandlers, createStdCameraPlugin, getStdCameraState } from "../src/index.js";

const filePath = "scenario/std-camera-save-load.tzr";

describe("std camera save/load integration", () => {
  it("keeps durable camera state across snapshot restore and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  camera x=80 y=-20 zoom=1.15 duration=500 easing=easeOut
  camera focus tone_stand zoom=1.2 duration=400
  narration:
    After camera.
  reset camera duration=300
  narration:
    Done.
`);
    const commandHandlers = createStdCameraCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdCameraPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const camera = stepRuntime(document, scene.state, { commandHandlers });
    const focus = stepRuntime(document, camera.state, { commandHandlers });

    expect(getStdCameraState(camera.state)).toEqual({
      x: 80,
      y: -20,
      zoom: 1.15,
      focusTarget: null,
      transition: { durationMs: 500, easing: "easeOut" },
    });
    expect(getStdCameraState(focus.state)).toEqual({
      x: 0,
      y: 0,
      zoom: 1.2,
      focusTarget: "tone_stand",
      transition: { durationMs: 400, easing: "ease" },
    });

    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(focus.state)));

    expect(restored.pointer).toEqual({ filePath, instructionIndex: 3 });
    expect(getStdCameraState(restored)).toEqual({
      x: 0,
      y: 0,
      zoom: 1.2,
      focusTarget: "tone_stand",
      transition: { durationMs: 400, easing: "ease" },
    });

    const afterCamera = stepRuntime(document, restored, { commandHandlers });
    expect(afterCamera.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After camera." }],
    });
    expect(getStdCameraState(afterCamera.state)).toEqual(getStdCameraState(restored));

    const reset = stepRuntime(document, afterCamera.state, { commandHandlers });
    expect(getStdCameraState(reset.state)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
      focusTarget: null,
      transition: { durationMs: 300, easing: "ease" },
    });

    const done = stepRuntime(document, reset.state, { commandHandlers });
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
    plugins: [createStdCameraPlugin()],
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
