import {
  type CommandInstruction,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  type RuntimeDocument,
  restoreRuntimeState,
  stepRuntime,
  type TzrArgument,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  getStdAudioState,
  prepareStdAudioStateForSnapshot,
  stdAudioPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-audio.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-audio.tzr", line: 1, column: 1 },
};

describe("createStdAudioPlugin", () => {
  it("initializes runtimeState.plugins.stdAudio", () => {
    const plugin = createStdAudioPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdAudioPluginCommands);
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

describe("std-audio commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdAudioPluginCommands)).toEqual(["startBgm", "stopBgm", "se", "voice"]);
    expect(stdAudioPluginCommands.startBgm).toEqual({
      name: "startBgm",
      args: { kind: "positional", arguments: [{ type: "string", nonEmpty: true }] },
    });
    expect(stdAudioPluginCommands.stopBgm).toEqual({
      name: "stopBgm",
      args: { kind: "none" },
    });
    expect(stdAudioPluginCommands.se).toEqual({
      name: "se",
      args: { kind: "positional", arguments: [{ type: "string", nonEmpty: true }] },
    });
    expect(stdAudioPluginCommands.voice).toEqual({
      name: "voice",
      args: { kind: "positional", arguments: [{ type: "string", nonEmpty: true }] },
    });
  });

  it("starts, overwrites, and stops BGM", () => {
    const result = runStdAudioCommands(
      command("startBgm", [positionalString("main_theme")]),
      command("startBgm", [positionalString("battle_theme")]),
      command("stopBgm", []),
    );

    expect(getStdAudioState(result.state).bgm).toBeNull();
  });

  it("appends SE and voice events with increasing sequences", () => {
    const result = runStdAudioCommands(
      command("se", [positionalString("click")]),
      command("se", [positionalString("confirm")]),
      command("voice", [positionalString("alice_001")]),
      command("voice", [positionalString("alice_002")]),
    );

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [
        { assetId: "click", sequence: 1 },
        { assetId: "confirm", sequence: 2 },
      ],
      voiceEvents: [
        { assetId: "alice_001", sequence: 1 },
        { assetId: "alice_002", sequence: 2 },
      ],
      nextSeSequence: 3,
      nextVoiceSequence: 3,
    });
  });

  it("does not affect SE or voice state when BGM commands run", () => {
    const result = runStdAudioCommands(
      command("se", [positionalString("click")]),
      command("voice", [positionalString("alice_001")]),
      command("startBgm", [positionalString("main_theme")]),
      command("stopBgm", []),
    );

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
  });

  it("throws on invalid runtime arguments after legacy compile-time validation removal", () => {
    expect(() => runStdAudioCommands(command("startBgm", [positionalString("")]))).toThrow(
      "Invalid @startBgm runtime arguments. Expected validated std audio command arguments.",
    );
    expect(() => runStdAudioCommands(command("stopBgm", [positionalString("main_theme")]))).toThrow(
      "Invalid @stopBgm runtime arguments. Expected validated std audio command arguments.",
    );
    expect(() => runStdAudioCommands(command("se", [positionalString("")]))).toThrow(
      "Invalid @se runtime arguments. Expected validated std audio command arguments.",
    );
    expect(() => runStdAudioCommands(command("voice", [positionalString("")]))).toThrow(
      "Invalid @voice runtime arguments. Expected validated std audio command arguments.",
    );
  });
});

describe("prepareStdAudioStateForSnapshot", () => {
  it("clears SE and voice events while preserving BGM and sequence counters", () => {
    const result = runStdAudioCommands(
      command("startBgm", [positionalString("main_theme")]),
      command("se", [positionalString("click")]),
      command("se", [positionalString("confirm")]),
      command("voice", [positionalString("alice_001")]),
    );

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
    const result = runStdAudioCommands(
      command("se", [positionalString("click")]),
      command("voice", [positionalString("alice_001")]),
    );

    prepareStdAudioStateForSnapshot(result.state);

    expect(getStdAudioState(result.state)).toEqual({
      bgm: null,
      seEvents: [{ assetId: "click", sequence: 1 }],
      voiceEvents: [{ assetId: "alice_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });
  });

  it("round-trips through createRuntimeSnapshot and restoreRuntimeState", () => {
    const result = runStdAudioCommands(
      command("startBgm", [positionalString("main_theme")]),
      command("se", [positionalString("click")]),
      command("voice", [positionalString("alice_001")]),
    );

    const saveReadyState = prepareStdAudioStateForSnapshot(result.state);
    const snapshot = createRuntimeSnapshot(saveReadyState);
    const restored = restoreRuntimeState(snapshot);

    expect(getStdAudioState(restored)).toEqual({
      bgm: { assetId: "main_theme" },
      seEvents: [],
      voiceEvents: [],
      nextSeSequence: 2,
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

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-audio.tzr",
    instructions,
    labels: {},
    scenes: {},
  };
}

function command(name: string, args: readonly TzrArgument[]): CommandInstruction {
  return {
    type: "CommandInstruction",
    name,
    args,
    loc,
  };
}

function positionalString(value: string): TzrArgument {
  return {
    type: "PositionalArgument",
    value: { type: "StringValue", value, loc },
    loc,
  };
}

function runStdAudioCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdAudioPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdAudioCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
