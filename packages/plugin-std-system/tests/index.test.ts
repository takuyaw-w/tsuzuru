import {
  type CommandInstruction,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  type RuntimeDocument,
  restoreRuntimeState,
  stepRuntime,
  type TzrArgument,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdSystemCommandHandlers,
  createStdSystemPlugin,
  getStdSystemState,
  isAchievementUnlocked,
  isCgUnlocked,
  isEndingUnlocked,
  isStdSystemState,
  stdSystemPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-system.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-system.tzr", line: 1, column: 1 },
};

const initialSystemState = {
  endings: {},
  cgs: {},
  achievements: {},
};

describe("createStdSystemPlugin", () => {
  it("initializes runtimeState.plugins.stdSystem", () => {
    const plugin = createStdSystemPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdSystemPluginCommands);
    expect(state.plugins.stdSystem).toEqual(initialSystemState);
  });

  it("returns initialized stdSystem state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdSystemPlugin()],
    });

    expect(getStdSystemState(state)).toEqual(initialSystemState);
  });

  it("throws when stdSystem state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdSystemState(state)).toThrow(
      "runtimeState.plugins.stdSystem is not initialized. Register createStdSystemPlugin().",
    );
  });

  it("checks stdSystem state shape", () => {
    expect(isStdSystemState(initialSystemState)).toBe(true);
    expect(isStdSystemState({ endings: { trueEnd: { unlocked: true } }, cgs: {}, achievements: {} })).toBe(true);
    expect(isStdSystemState({ endings: { trueEnd: { unlocked: false } }, cgs: {}, achievements: {} })).toBe(true);
    expect(isStdSystemState({ endings: {}, achievements: {} })).toBe(false);
  });
});

describe("std-system commands", () => {
  it("keeps plugin command metadata available for call system integrations", () => {
    expect(stdSystemPluginCommands).toEqual({
      "system.unlockEnding": {
        name: "system.unlockEnding",
        args: {
          kind: "named",
          arguments: [{ name: "id", type: ["string", "identifier"], nonEmpty: true }],
        },
      },
      "system.unlockCg": {
        name: "system.unlockCg",
        args: {
          kind: "named",
          arguments: [{ name: "id", type: ["string", "identifier"], nonEmpty: true }],
        },
      },
      "system.unlockAchievement": {
        name: "system.unlockAchievement",
        args: {
          kind: "named",
          arguments: [{ name: "id", type: ["string", "identifier"], nonEmpty: true }],
        },
      },
    });
  });

  it("unlocks endings by id", () => {
    const result = runStdSystemCommands(command("system.unlockEnding", [namedIdentifier("id", "trueEnd")]));

    expect(getStdSystemState(result.state)).toEqual({
      endings: { trueEnd: { unlocked: true } },
      cgs: {},
      achievements: {},
    });
  });

  it("unlocks cgs by id", () => {
    const result = runStdSystemCommands(command("system.unlockCg", [namedIdentifier("id", "textSoundLab")]));

    expect(getStdSystemState(result.state)).toEqual({
      endings: {},
      cgs: { textSoundLab: { unlocked: true } },
      achievements: {},
    });
  });

  it("unlocks achievements by id", () => {
    const result = runStdSystemCommands(
      command("system.unlockAchievement", [namedIdentifier("id", "firstTextSoundLab")]),
    );

    expect(getStdSystemState(result.state)).toEqual({
      endings: {},
      cgs: {},
      achievements: { firstTextSoundLab: { unlocked: true } },
    });
  });

  it("accepts string ids and helper checks", () => {
    const result = runStdSystemCommands(
      command("system.unlockEnding", [namedString("id", "true-end")]),
      command("system.unlockCg", [namedString("id", "text-sound-lab")]),
      command("system.unlockAchievement", [namedString("id", "first-text-sound-lab")]),
    );
    const state = getStdSystemState(result.state);

    expect(isEndingUnlocked(state, "true-end")).toBe(true);
    expect(isCgUnlocked(state, "text-sound-lab")).toBe(true);
    expect(isAchievementUnlocked(state, "first-text-sound-lab")).toBe(true);
    expect(isEndingUnlocked(state, "missing")).toBe(false);
  });

  it("keeps repeated unlock idempotent", () => {
    const result = runStdSystemCommands(
      command("system.unlockEnding", [namedIdentifier("id", "trueEnd")]),
      command("system.unlockEnding", [namedIdentifier("id", "trueEnd")]),
    );

    expect(getStdSystemState(result.state)).toEqual({
      endings: { trueEnd: { unlocked: true } },
      cgs: {},
      achievements: {},
    });
  });

  it("round-trips unlock state through snapshot and restore", () => {
    const result = runStdSystemCommands(
      command("system.unlockEnding", [namedIdentifier("id", "trueEnd")]),
      command("system.unlockCg", [namedString("id", "gallery-main")]),
      command("system.unlockAchievement", [namedIdentifier("id", "firstClear")]),
    );

    const restored = restoreRuntimeState(createRuntimeSnapshot(result.state));

    expect(getStdSystemState(restored)).toEqual({
      endings: { trueEnd: { unlocked: true } },
      cgs: { "gallery-main": { unlocked: true } },
      achievements: { firstClear: { unlocked: true } },
    });
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() => runStdSystemCommands(command("system.unlockEnding", []))).toThrow(
      "Invalid @system.unlockEnding runtime arguments. Expected validated std system command arguments.",
    );
    expect(() => runStdSystemCommands(command("system.unlockCg", [namedString("id", "")]))).toThrow(
      "Invalid @system.unlockCg runtime arguments. Expected validated std system command arguments.",
    );
    expect(() =>
      runStdSystemCommands(
        command("system.unlockAchievement", [namedIdentifier("id", "firstClear"), namedString("extra", "x")]),
      ),
    ).toThrow("Invalid @system.unlockAchievement runtime arguments. Expected validated std system command arguments.");
  });

  it("validates missing empty and extra call arguments at compile time", () => {
    expect(expectCompileFailure("scene start:\n  call system.unlockEnding()\n")).toContain(
      'Plugin command "system.unlockEnding" is missing required named argument "id".',
    );
    expect(expectCompileFailure('scene start:\n  call system.unlockCg(id="")\n')).toContain(
      'Plugin command "system.unlockCg" named argument "id" must not be empty.',
    );
    expect(
      expectCompileFailure("scene start:\n  call system.unlockAchievement(id=firstClear, extra=true)\n"),
    ).toContain('Plugin command "system.unlockAchievement" does not support named argument "extra".');
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-system.tzr",
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

function namedIdentifier(name: string, value: string): TzrArgument {
  return {
    type: "NamedArgument",
    name,
    value: { type: "IdentifierValue", name: value, loc },
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

function runStdSystemCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdSystemPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdSystemCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}

function expectCompileFailure(source: string): string[] {
  const parsed = parseTzr(source, { filePath: "scenario/std-system.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  const compiled = compileTzr(parsed.document, {
    plugins: [createStdSystemPlugin()],
  });
  expect(compiled.ok).toBe(false);
  if (compiled.ok) {
    throw new Error("expected compiler failure");
  }

  return compiled.errors.map((error) => error.message);
}
