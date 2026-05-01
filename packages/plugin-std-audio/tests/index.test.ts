import { describe, expect, it } from "vitest";
import { compileTzr, createInitialRuntimeState, parseTzr } from "@tsuzuru/core";
import { createStdAudioPlugin, getStdAudioState } from "../src/index.js";

describe("createStdAudioPlugin", () => {
  it("initializes runtimeState.plugins.stdAudio", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdAudioPlugin()],
    });

    expect(state.plugins.stdAudio).toEqual({
      bgm: null,
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 1,
      nextVoiceSequence: 1,
    });
  });

  it("returns initialized stdAudio state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdAudioPlugin()],
    });

    expect(getStdAudioState(state)).toEqual({
      bgm: null,
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 1,
      nextVoiceSequence: 1,
    });
  });

  it("throws when stdAudio state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdAudioState(state)).toThrow(
      "runtimeState.plugins.stdAudio is not initialized. Register createStdAudioPlugin().",
    );
  });
});

function createDocument() {
  const parsed = parseTzr("#scene(\"main\")\n", { filePath: "scenario/main.tzr" });
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
