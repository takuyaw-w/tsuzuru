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
  createStdEffectCommandHandlers,
  createStdEffectPlugin,
  getStdEffectState,
  prepareStdEffectStateForSnapshot,
  stdEffectPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-effect.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-effect.tzr", line: 1, column: 1 },
};

describe("createStdEffectPlugin", () => {
  it("initializes runtimeState.plugins.stdEffect", () => {
    const plugin = createStdEffectPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdEffectPluginCommands);
    expect(state.plugins.stdEffect).toEqual({
      events: [],
      nextSequence: 1,
    });
  });

  it("returns initialized stdEffect state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdEffectPlugin()],
    });

    expect(getStdEffectState(state)).toEqual({
      events: [],
      nextSequence: 1,
    });
  });

  it("throws when stdEffect state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdEffectState(state)).toThrow(
      "runtimeState.plugins.stdEffect is not initialized. Register createStdEffectPlugin().",
    );
  });
});

describe("std-effect commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdEffectPluginCommands)).toEqual(["shake", "flash", "pulse", "blur"]);
    expect(stdEffectPluginCommands.shake).toEqual({
      name: "shake",
      args: {
        kind: "mixed",
        positional: [{ type: "string", values: ["screen", "message", "sprites"] }],
        named: [
          { name: "intensity", type: "string", optional: true, values: ["light", "normal", "strong"] },
          { name: "duration", type: "number", integer: true, min: 0 },
        ],
      },
    });
    expect(stdEffectPluginCommands.flash).toEqual({
      name: "flash",
      args: {
        kind: "named",
        arguments: [
          { name: "color", type: "string", nonEmpty: true },
          { name: "duration", type: "number", integer: true, min: 0 },
        ],
      },
    });
    expect(stdEffectPluginCommands.pulse).toEqual(
      stdEffectPluginCommands.shake && {
        name: "pulse",
        args: stdEffectPluginCommands.shake.args,
      },
    );
    expect(stdEffectPluginCommands.blur).toEqual({
      name: "blur",
      args: {
        kind: "mixed",
        positional: [{ type: "string", values: ["screen"] }],
        named: [
          { name: "amount", type: "number", min: 0 },
          { name: "duration", type: "number", integer: true, min: 0 },
        ],
      },
    });
  });

  it("appends shake, flash, pulse, and blur events with increasing sequences", () => {
    const result = runStdEffectCommands(
      command("shake", [positionalString("screen"), namedString("intensity", "strong"), namedNumber("duration", 400)]),
      command("flash", [namedString("color", "#ffffff"), namedNumber("duration", 120)]),
      command("pulse", [positionalString("message"), namedString("intensity", "light"), namedNumber("duration", 180)]),
      command("blur", [positionalString("screen"), namedNumber("amount", 6), namedNumber("duration", 300)]),
    );

    expect(getStdEffectState(result.state)).toEqual({
      events: [
        { sequence: 1, type: "shake", target: "screen", intensity: "strong", durationMs: 400 },
        { sequence: 2, type: "flash", color: "#ffffff", durationMs: 120 },
        { sequence: 3, type: "pulse", target: "message", intensity: "light", durationMs: 180 },
        { sequence: 4, type: "blur", target: "screen", amount: 6, durationMs: 300 },
      ],
      nextSequence: 5,
    });
  });

  it("defaults shake and pulse intensity to normal", () => {
    const result = runStdEffectCommands(
      command("shake", [positionalString("message"), namedNumber("duration", 180)]),
      command("pulse", [positionalString("sprites"), namedNumber("duration", 240)]),
    );

    expect(getStdEffectState(result.state).events).toEqual([
      { sequence: 1, type: "shake", target: "message", intensity: "normal", durationMs: 180 },
      { sequence: 2, type: "pulse", target: "sprites", intensity: "normal", durationMs: 240 },
    ]);
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() =>
      runStdEffectCommands(command("shake", [positionalString("stage"), namedNumber("duration", 100)])),
    ).toThrow("Invalid @shake runtime arguments. Expected validated std effect command arguments.");
    expect(() =>
      runStdEffectCommands(
        command("shake", [positionalString("screen"), namedString("intensity", "huge"), namedNumber("duration", 100)]),
      ),
    ).toThrow("Invalid @shake runtime arguments. Expected validated std effect command arguments.");
    expect(() =>
      runStdEffectCommands(command("shake", [positionalString("screen"), namedNumber("duration", -1)])),
    ).toThrow("Invalid @shake runtime arguments. Expected validated std effect command arguments.");
    expect(() =>
      runStdEffectCommands(
        command("blur", [positionalString("message"), namedNumber("amount", 6), namedNumber("duration", 300)]),
      ),
    ).toThrow("Invalid @blur runtime arguments. Expected validated std effect command arguments.");
    expect(() =>
      runStdEffectCommands(
        command("blur", [positionalString("screen"), namedNumber("amount", -1), namedNumber("duration", 300)]),
      ),
    ).toThrow("Invalid @blur runtime arguments. Expected validated std effect command arguments.");
    expect(() =>
      runStdEffectCommands(command("flash", [namedString("color", "white"), namedNumber("duration", 120)])),
    ).toThrow("Invalid @flash runtime arguments. Expected validated std effect command arguments.");
  });
});

describe("prepareStdEffectStateForSnapshot", () => {
  it("clears events while preserving the sequence counter", () => {
    const result = runStdEffectCommands(
      command("shake", [positionalString("screen"), namedNumber("duration", 180)]),
      command("flash", [namedString("color", "#fff"), namedNumber("duration", 120)]),
    );

    const saveReadyState = prepareStdEffectStateForSnapshot(result.state);

    expect(getStdEffectState(saveReadyState)).toEqual({
      events: [],
      nextSequence: 3,
    });
  });

  it("does not mutate the original runtime state", () => {
    const result = runStdEffectCommands(
      command("flash", [namedString("color", "#ffffff"), namedNumber("duration", 120)]),
    );

    prepareStdEffectStateForSnapshot(result.state);

    expect(getStdEffectState(result.state)).toEqual({
      events: [{ sequence: 1, type: "flash", color: "#ffffff", durationMs: 120 }],
      nextSequence: 2,
    });
  });

  it("round-trips through createRuntimeSnapshot and restoreRuntimeState", () => {
    const result = runStdEffectCommands(command("pulse", [positionalString("screen"), namedNumber("duration", 240)]));

    const saveReadyState = prepareStdEffectStateForSnapshot(result.state);
    const snapshot = createRuntimeSnapshot(saveReadyState);
    const restored = restoreRuntimeState(snapshot);

    expect(getStdEffectState(restored)).toEqual({
      events: [],
      nextSequence: 2,
    });
  });

  it("throws when stdEffect state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => prepareStdEffectStateForSnapshot(state)).toThrow(
      "runtimeState.plugins.stdEffect is not initialized. Register createStdEffectPlugin().",
    );
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-effect.tzr",
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

function namedString(name: string, value: string): TzrArgument {
  return {
    type: "NamedArgument",
    name,
    value: { type: "StringValue", value, loc },
    loc,
  };
}

function namedNumber(name: string, value: number): TzrArgument {
  return {
    type: "NamedArgument",
    name,
    value: { type: "NumberValue", value, loc },
    loc,
  };
}

function runStdEffectCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdEffectPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdEffectCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
