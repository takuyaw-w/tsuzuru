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
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  getStdAudioState,
  prepareStdAudioStateForSnapshot,
} from "../src/index.js";

const filePath = "scenario/std-audio-save-load.tzr";

describe("std audio save/load integration", () => {
  it("keeps durable BGM, clears one-shot audio events before save, and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  bgm bgm_main
  se click
  voice line_001
  narration:
    After audio events.
  stopBgm
  narration:
    Done.
`);
    const commandHandlers = createStdAudioCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdAudioPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const startBgm = stepRuntime(document, scene.state, { commandHandlers });
    const se = stepRuntime(document, startBgm.state, { commandHandlers });
    const voice = stepRuntime(document, se.state, { commandHandlers });

    expect(getStdAudioState(startBgm.state)).toEqual({
      bgm: { assetId: "bgm_main" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 1,
      nextVoiceSequence: 1,
    });
    expect(getStdAudioState(se.state)).toEqual({
      bgm: { assetId: "bgm_main" },
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 1,
    });
    expect(getStdAudioState(voice.state)).toEqual({
      bgm: { assetId: "bgm_main" },
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [{ assetId: "line_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });

    const saveReadyState = prepareStdAudioStateForSnapshot(voice.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(saveReadyState)));

    expect(getStdAudioState(saveReadyState)).toEqual({
      bgm: { assetId: "bgm_main" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
    expect(restored.pointer).toEqual({ filePath, instructionIndex: 4 });
    expect(getStdAudioState(restored)).toEqual({
      bgm: { assetId: "bgm_main" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });

    const afterAudioEvents = stepRuntime(document, restored, { commandHandlers });
    expect(afterAudioEvents.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After audio events." }],
    });
    expect(getStdAudioState(afterAudioEvents.state)).toEqual({
      bgm: { assetId: "bgm_main" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });

    const stopBgm = stepRuntime(document, afterAudioEvents.state, { commandHandlers });
    expect(stopBgm.event).toEqual({ type: "pluginCommand", name: "stopBgm" });
    expect(getStdAudioState(stopBgm.state)).toEqual({
      bgm: null,
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });

    const done = stepRuntime(document, stopBgm.state, { commandHandlers });
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
    plugins: [createStdAudioPlugin()],
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
