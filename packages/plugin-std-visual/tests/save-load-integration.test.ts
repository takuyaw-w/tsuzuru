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
import { createStdVisualCommandHandlers, createStdVisualPlugin, getStdVisualState } from "../src/index.js";

const filePath = "scenario/std-visual-save-load.tzr";

describe("std visual save/load integration", () => {
  it("keeps durable background and sprite state across snapshot restore and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  bg station with fade(duration=300)
  show mio_smile at left with dissolve(duration=200)
  narration:
    After visual state.
  hide mio_smile
  clear bg
  narration:
    Done.
`);
    const commandHandlers = createStdVisualCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdVisualPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const background = stepRuntime(document, scene.state, { commandHandlers });
    const sprite = stepRuntime(document, background.state, { commandHandlers });

    expect(getStdVisualState(background.state)).toEqual({
      background: {
        assetId: "station",
        transition: { type: "fade", durationMs: 300 },
      },
      sprites: {},
    });
    expect(getStdVisualState(sprite.state)).toEqual({
      background: {
        assetId: "station",
        transition: { type: "fade", durationMs: 300 },
      },
      sprites: {
        mio_smile: {
          position: "left",
          transition: { type: "dissolve", durationMs: 200 },
        },
      },
    });

    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(sprite.state)));

    expect(restored.pointer).toEqual({ filePath, instructionIndex: 3 });
    expect(getStdVisualState(restored)).toEqual({
      background: {
        assetId: "station",
        transition: { type: "fade", durationMs: 300 },
      },
      sprites: {
        mio_smile: {
          position: "left",
          transition: { type: "dissolve", durationMs: 200 },
        },
      },
    });

    const afterVisualState = stepRuntime(document, restored, { commandHandlers });
    expect(afterVisualState.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After visual state." }],
    });
    expect(getStdVisualState(afterVisualState.state)).toEqual(getStdVisualState(restored));

    const hide = stepRuntime(document, afterVisualState.state, { commandHandlers });
    expect(hide.event).toEqual({ type: "pluginCommand", name: "hide" });
    expect(getStdVisualState(hide.state)).toEqual({
      background: {
        assetId: "station",
        transition: { type: "fade", durationMs: 300 },
      },
      sprites: {},
    });

    const clearBg = stepRuntime(document, hide.state, { commandHandlers });
    expect(clearBg.event).toEqual({ type: "pluginCommand", name: "clearBg" });
    expect(getStdVisualState(clearBg.state)).toEqual({
      background: null,
      sprites: {},
    });

    const done = stepRuntime(document, clearBg.state, { commandHandlers });
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
    plugins: [createStdVisualPlugin()],
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
