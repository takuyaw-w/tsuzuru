import {
  type CommandInstruction,
  compileTzr,
  createInitialRuntimeState,
  parseTzr,
  type RuntimeDocument,
  stepRuntime,
  type TzrArgument,
  validatePluginCommandArguments,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdTextSoundCommandHandlers,
  createStdTextSoundPlugin,
  getStdTextSoundState,
  stdTextSoundPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-text-sound.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-text-sound.tzr", line: 1, column: 1 },
};

describe("createStdTextSoundPlugin", () => {
  it("initializes runtimeState.plugins.stdTextSound", () => {
    const plugin = createStdTextSoundPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdTextSoundPluginCommands);
    expect(state.plugins.stdTextSound).toEqual({
      current: null,
    });
  });

  it("returns initialized stdTextSound state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdTextSoundPlugin()],
    });

    expect(getStdTextSoundState(state)).toEqual({
      current: null,
    });
  });

  it("throws when stdTextSound state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdTextSoundState(state)).toThrow(
      "runtimeState.plugins.stdTextSound is not initialized. Register createStdTextSoundPlugin().",
    );
  });
});

describe("std-text-sound commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdTextSoundPluginCommands)).toEqual(["textSound", "stopTextSound"]);
    expect(stdTextSoundPluginCommands.textSound).toEqual({
      name: "textSound",
      args: { kind: "positional", arguments: [{ type: "string", nonEmpty: true }] },
    });
    expect(stdTextSoundPluginCommands.stopTextSound).toEqual({
      name: "stopTextSound",
      args: { kind: "none" },
    });
  });

  it("sets the current text sound", () => {
    const result = runStdTextSoundCommands(command("textSound", [positionalString("soft")]));

    expect(getStdTextSoundState(result.state)).toEqual({
      current: { assetId: "soft" },
    });
  });

  it("reassigns and overwrites the current text sound", () => {
    const result = runStdTextSoundCommands(
      command("textSound", [positionalString("soft")]),
      command("textSound", [positionalString("another")]),
    );

    expect(getStdTextSoundState(result.state)).toEqual({
      current: { assetId: "another" },
    });
  });

  it("stops the current text sound", () => {
    const result = runStdTextSoundCommands(
      command("textSound", [positionalString("soft")]),
      command("stopTextSound", []),
    );

    expect(getStdTextSoundState(result.state)).toEqual({
      current: null,
    });
  });

  it("keeps stopTextSound as a no-op when no text sound is active", () => {
    const result = runStdTextSoundCommands(command("stopTextSound", []));

    expect(getStdTextSoundState(result.state)).toEqual({
      current: null,
    });
  });

  it("validates empty asset ids and unsupported extra args through command metadata", () => {
    expect(
      validatePluginCommandArguments(stdTextSoundPluginCommands.textSound, [positionalString("")], loc.start).map(
        (diagnostic) => diagnostic.message,
      ),
    ).toContain('Plugin command "textSound" positional argument 1 must not be empty.');

    expect(
      validatePluginCommandArguments(
        stdTextSoundPluginCommands.textSound,
        [positionalString("soft"), positionalString("extra")],
        loc.start,
      ).map((diagnostic) => diagnostic.message),
    ).toContain('Plugin command "textSound" expects at most 1 positional argument but received 2.');

    expect(
      validatePluginCommandArguments(
        stdTextSoundPluginCommands.stopTextSound,
        [positionalString("soft")],
        loc.start,
      ).map((diagnostic) => diagnostic.message),
    ).toContain('Plugin command "stopTextSound" expects at most 0 positional arguments but received 1.');
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() => runStdTextSoundCommands(command("textSound", [positionalString("")]))).toThrow(
      "Invalid @textSound runtime arguments. Expected validated std text sound command arguments.",
    );
    expect(() => runStdTextSoundCommands(command("stopTextSound", [positionalString("soft")]))).toThrow(
      "Invalid @stopTextSound runtime arguments. Expected validated std text sound command arguments.",
    );
  });

  it("runs compiled textSound and stopTextSound through runtime plugin handlers", () => {
    const parsed = parseTzr(
      `scene start:
  textSound soft
  stopTextSound
`,
      { filePath: "scenario/std-text-sound.tzr" },
    );
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

    let state = createInitialRuntimeState(compiled.document, {
      plugins: [createStdTextSoundPlugin()],
    });
    state = stepRuntime(compiled.document, state).state;

    const textSound = stepRuntime(compiled.document, state, {
      commandHandlers: createStdTextSoundCommandHandlers(),
    });
    expect(textSound.event).toEqual({ type: "pluginCommand", name: "textSound" });
    expect(getStdTextSoundState(textSound.state)).toEqual({ current: { assetId: "soft" } });

    const stopTextSound = stepRuntime(compiled.document, textSound.state, {
      commandHandlers: createStdTextSoundCommandHandlers(),
    });
    expect(stopTextSound.event).toEqual({ type: "pluginCommand", name: "stopTextSound" });
    expect(getStdTextSoundState(stopTextSound.state)).toEqual({ current: null });
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-text-sound.tzr",
    instructions,
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

function runStdTextSoundCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdTextSoundPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdTextSoundCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
