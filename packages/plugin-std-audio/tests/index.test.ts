import { describe, expect, it } from "vitest";
import { compileTzr, createInitialRuntimeState, parseTzr, stepRuntime } from "@tsuzuru/core";
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  getStdAudioState,
  stdAudioPluginCommands,
} from "../src/index.js";

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

describe("std-audio BGM commands", () => {
  it("starts BGM with @startBgm", () => {
    const result = runStdAudioScript('@startBgm("main_theme")\n');

    expect(getStdAudioState(result.state).bgm).toEqual({ assetId: "main_theme" });
  });

  it("overwrites the previous BGM when @startBgm runs again", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@startBgm("battle_theme")
`);

    expect(getStdAudioState(result.state).bgm).toEqual({ assetId: "battle_theme" });
  });

  it("stops BGM with @stopBgm", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@stopBgm()
`);

    expect(getStdAudioState(result.state).bgm).toBeNull();
  });

  it("does not warn when @stopBgm runs without active BGM", () => {
    const result = runStdAudioScript("@stopBgm()\n");

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 1,
      nextVoiceSequence: 1,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects empty BGM asset ids", () => {
    const compiled = compileStdAudioScript('@startBgm("")\n');

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual([
      "@startBgm positional argument 1 must be a non-empty string.",
    ]);
  });

  it("rejects @stopBgm arguments", () => {
    const compiled = compileStdAudioScript('@stopBgm("main_theme")\n');

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual(["@stopBgm expects no arguments."]);
  });

  it("rejects unsupported @startBgm named arguments", () => {
    const compiled = compileStdAudioScript('@startBgm("main_theme", volume=0.8)\n');

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual([
      "@startBgm expects only positional arguments.",
      "@startBgm does not allow extra positional arguments.",
    ]);
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

function compileStdAudioScript(source: string) {
  const parsed = parseTzr(source, { filePath: "scenario/main.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  return compileTzr(parsed.document, {
    pluginCommands: stdAudioPluginCommands,
  });
}

function runStdAudioScript(source: string) {
  const compiled = compileStdAudioScript(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }

  const diagnostics: Array<{ readonly severity: "warning"; readonly code: string; readonly message: string }> = [];
  let state = createInitialRuntimeState(compiled.document, {
    plugins: [createStdAudioPlugin()],
  });

  for (let index = 0; index < compiled.document.instructions.length; index += 1) {
    const result = stepRuntime(compiled.document, state, {
      commandHandlers: createStdAudioCommandHandlers(),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    state = result.state;
  }

  return { state, diagnostics };
}
