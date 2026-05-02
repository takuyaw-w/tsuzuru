import { describe, expect, it } from "vitest";
import {
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  restoreRuntimeState,
  stepRuntime,
} from "@tsuzuru/core";
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  getStdAudioState,
  prepareStdAudioStateForSnapshot,
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

  it("does not affect SE or voice state when BGM commands run", () => {
    const result = runStdAudioScript(`@se("click")
@voice("alice_001")
@startBgm("main_theme")
@stopBgm()
`);

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
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

describe("std-audio SE commands", () => {
  it("appends an SE event and increments nextSeSequence", () => {
    const result = runStdAudioScript('@se("click")\n');

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 1,
    });
  });

  it("appends multiple SE events with increasing sequences", () => {
    const result = runStdAudioScript(`@se("click")
@se("click")
@se("confirm")
`);

    expect(getStdAudioState(result.state).seEvents).toEqual([
      { assetId: "click", sequence: 1 },
      { assetId: "click", sequence: 2 },
      { assetId: "confirm", sequence: 3 },
    ]);
    expect(getStdAudioState(result.state).nextSeSequence).toBe(4);
  });

  it("does not affect BGM or voice state when @se runs", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@voice("alice_001")
@se("click")
`);

    expect(getStdAudioState(result.state)).toEqual({
      bgm: { assetId: "main_theme" },
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
  });

  it("rejects invalid @se arguments", () => {
    const compiled = compileStdAudioScript(`@se("")
@se("click", volume=0.8)
`);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual([
      "@se positional argument 1 must be a non-empty string.",
      "@se expects only positional arguments.",
      "@se does not allow extra positional arguments.",
    ]);
  });

  it("rejects bare @se syntax", () => {
    const parsed = parseTzr("@se\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("expected parser failure");
    }
    expect(parsed.errors.map((error) => error.message)).toEqual(["@ call must use @name(...) syntax."]);
  });
});

describe("std-audio voice commands", () => {
  it("appends a voice event and increments nextVoiceSequence", () => {
    const result = runStdAudioScript('@voice("alice_001")\n');

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 1,
      nextVoiceSequence: 2,
    });
  });

  it("appends multiple voice events with increasing sequences", () => {
    const result = runStdAudioScript(`@voice("alice_001")
@voice("alice_001")
@voice("alice_002")
`);

    expect(getStdAudioState(result.state).voiceEvents).toEqual([
      { assetId: "alice_001", sequence: 1 },
      { assetId: "alice_001", sequence: 2 },
      { assetId: "alice_002", sequence: 3 },
    ]);
    expect(getStdAudioState(result.state).nextVoiceSequence).toBe(4);
  });

  it("does not affect BGM or SE state when @voice runs", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@se("click")
@voice("alice_001")
`);

    expect(getStdAudioState(result.state)).toEqual({
      bgm: { assetId: "main_theme" },
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
  });

  it("rejects invalid @voice arguments", () => {
    const compiled = compileStdAudioScript(`@voice("")
@voice("alice_001", volume=0.8)
`);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual([
      "@voice positional argument 1 must be a non-empty string.",
      "@voice expects only positional arguments.",
      "@voice does not allow extra positional arguments.",
    ]);
  });

  it("rejects bare @voice syntax", () => {
    const parsed = parseTzr("@voice\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error("expected parser failure");
    }
    expect(parsed.errors.map((error) => error.message)).toEqual(["@ call must use @name(...) syntax."]);
  });
});

describe("prepareStdAudioStateForSnapshot", () => {
  it("clears SE and voice events while preserving BGM and sequence counters", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@se("click")
@se("confirm")
@voice("alice_001")
`);

    const saveReadyState = prepareStdAudioStateForSnapshot(result.state);

    expect(getStdAudioState(saveReadyState)).toEqual({
      bgm: { assetId: "main_theme" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 3,
      nextVoiceSequence: 2,
    });
  });

  it("does not mutate the original runtime state", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@se("click")
@se("confirm")
@voice("alice_001")
`);

    prepareStdAudioStateForSnapshot(result.state);

    expect(getStdAudioState(result.state)).toEqual({
      bgm: { assetId: "main_theme" },
      seEvents: [
        { assetId: "click", sequence: 1 },
        { assetId: "confirm", sequence: 2 },
      ],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 3,
      nextVoiceSequence: 2,
    });
  });

  it("preserves null BGM while clearing one-shot events", () => {
    const result = runStdAudioScript(`@se("click")
@voice("alice_001")
`);

    const saveReadyState = prepareStdAudioStateForSnapshot(result.state);

    expect(getStdAudioState(saveReadyState)).toEqual({
      bgm: null,
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
  });

  it("round-trips through createRuntimeSnapshot and restoreRuntimeState", () => {
    const result = runStdAudioScript(`@startBgm("main_theme")
@se("click")
@se("confirm")
@voice("alice_001")
`);

    const saveReadyState = prepareStdAudioStateForSnapshot(result.state);
    const snapshot = createRuntimeSnapshot(saveReadyState);
    const restored = restoreRuntimeState(snapshot);

    expect(getStdAudioState(restored)).toEqual({
      bgm: { assetId: "main_theme" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 3,
      nextVoiceSequence: 2,
    });
  });

  it("throws when stdAudio state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => prepareStdAudioStateForSnapshot(state)).toThrow(
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
