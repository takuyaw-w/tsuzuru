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
  createStdTransitionCommandHandlers,
  createStdTransitionPlugin,
  getStdTransitionState,
  prepareStdTransitionStateForSnapshot,
  stdTransitionPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-transition.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-transition.tzr", line: 1, column: 1 },
};

describe("createStdTransitionPlugin", () => {
  it("initializes runtimeState.plugins.stdTransition", () => {
    const plugin = createStdTransitionPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdTransitionPluginCommands);
    expect(state.plugins.stdTransition).toEqual({
      events: [],
      nextSequence: 1,
    });
  });

  it("returns initialized stdTransition state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdTransitionPlugin()],
    });

    expect(getStdTransitionState(state)).toEqual({
      events: [],
      nextSequence: 1,
    });
  });

  it("throws when stdTransition state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdTransitionState(state)).toThrow(
      "runtimeState.plugins.stdTransition is not initialized. Register createStdTransitionPlugin().",
    );
  });
});

describe("std-transition commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(stdTransitionPluginCommands.transition).toEqual({
      name: "transition",
      args: {
        kind: "mixed",
        positional: [{ type: "string", values: ["fade", "wipe", "flash", "pageTurn", "blurFade", "slide"] }],
        named: [
          { name: "duration", type: "number", integer: true, min: 1 },
          { name: "direction", type: "string", optional: true, values: ["left", "right", "up", "down"] },
          { name: "color", type: "string", optional: true },
        ],
      },
    });
  });

  it("appends fade, wipe, flash, pageTurn, blurFade, and slide events with increasing sequences", () => {
    const result = runStdTransitionCommands(
      command("transition", [positionalString("fade"), namedNumber("duration", 500), namedString("color", "#000000")]),
      command("transition", [positionalString("wipe"), namedNumber("duration", 600), namedString("direction", "left")]),
      command("transition", [positionalString("flash"), namedNumber("duration", 180), namedString("color", "#ffffff")]),
      command("transition", [
        positionalString("pageTurn"),
        namedNumber("duration", 800),
        namedString("direction", "left"),
        namedString("color", "#ffffff"),
      ]),
      command("transition", [
        positionalString("blurFade"),
        namedNumber("duration", 700),
        namedString("color", "#000000"),
      ]),
      command("transition", [
        positionalString("slide"),
        namedNumber("duration", 650),
        namedString("direction", "up"),
        namedString("color", "#000000"),
      ]),
    );

    expect(getStdTransitionState(result.state)).toEqual({
      events: [
        { sequence: 1, effect: "fade", durationMs: 500, color: "#000000" },
        { sequence: 2, effect: "wipe", durationMs: 600, direction: "left" },
        { sequence: 3, effect: "flash", durationMs: 180, color: "#ffffff" },
        { sequence: 4, effect: "pageTurn", durationMs: 800, direction: "left", color: "#ffffff" },
        { sequence: 5, effect: "blurFade", durationMs: 700, color: "#000000" },
        { sequence: 6, effect: "slide", durationMs: 650, direction: "up", color: "#000000" },
      ],
      nextSequence: 7,
    });
  });

  it("accepts compiler-supplied default values", () => {
    const result = runStdTransitionCommands(
      command("transition", [positionalString("fade"), namedNumber("duration", 400), namedString("color", "#000000")]),
      command("transition", [
        positionalString("wipe"),
        namedNumber("duration", 500),
        namedString("direction", "left"),
        namedString("color", "#000000"),
      ]),
      command("transition", [positionalString("flash"), namedNumber("duration", 180), namedString("color", "#ffffff")]),
      command("transition", [
        positionalString("pageTurn"),
        namedNumber("duration", 800),
        namedString("direction", "left"),
        namedString("color", "#ffffff"),
      ]),
      command("transition", [
        positionalString("blurFade"),
        namedNumber("duration", 700),
        namedString("color", "#000000"),
      ]),
      command("transition", [
        positionalString("slide"),
        namedNumber("duration", 600),
        namedString("direction", "left"),
        namedString("color", "#000000"),
      ]),
    );

    expect(getStdTransitionState(result.state).events).toEqual([
      { sequence: 1, effect: "fade", durationMs: 400, color: "#000000" },
      { sequence: 2, effect: "wipe", durationMs: 500, direction: "left", color: "#000000" },
      { sequence: 3, effect: "flash", durationMs: 180, color: "#ffffff" },
      { sequence: 4, effect: "pageTurn", durationMs: 800, direction: "left", color: "#ffffff" },
      { sequence: 5, effect: "blurFade", durationMs: 700, color: "#000000" },
      { sequence: 6, effect: "slide", durationMs: 600, direction: "left", color: "#000000" },
    ]);
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() =>
      runStdTransitionCommands(command("transition", [positionalString("dissolve"), namedNumber("duration", 100)])),
    ).toThrow("Invalid @transition runtime arguments. Expected validated std transition command arguments.");
    expect(() =>
      runStdTransitionCommands(
        command("transition", [
          positionalString("wipe"),
          namedNumber("duration", 100),
          namedString("direction", "diagonal"),
        ]),
      ),
    ).toThrow("Invalid @transition runtime arguments. Expected validated std transition command arguments.");
    expect(() =>
      runStdTransitionCommands(command("transition", [positionalString("fade"), namedNumber("duration", 0)])),
    ).toThrow("Invalid @transition runtime arguments. Expected validated std transition command arguments.");
    expect(() =>
      runStdTransitionCommands(command("transition", [positionalString("fade"), namedNumber("duration", -1)])),
    ).toThrow("Invalid @transition runtime arguments. Expected validated std transition command arguments.");
    expect(() =>
      runStdTransitionCommands(
        command("transition", [positionalString("fade"), namedNumber("duration", 100), namedString("speed", "fast")]),
      ),
    ).toThrow("Invalid @transition runtime arguments. Expected validated std transition command arguments.");
  });
});

describe("prepareStdTransitionStateForSnapshot", () => {
  it("clears events while preserving the sequence counter", () => {
    const result = runStdTransitionCommands(
      command("transition", [positionalString("fade"), namedNumber("duration", 500), namedString("color", "#000000")]),
      command("transition", [positionalString("wipe"), namedNumber("duration", 600), namedString("direction", "left")]),
    );

    const saveReadyState = prepareStdTransitionStateForSnapshot(result.state);

    expect(getStdTransitionState(saveReadyState)).toEqual({
      events: [],
      nextSequence: 3,
    });
  });

  it("does not mutate the original runtime state", () => {
    const result = runStdTransitionCommands(
      command("transition", [positionalString("flash"), namedNumber("duration", 180), namedString("color", "#ffffff")]),
    );

    prepareStdTransitionStateForSnapshot(result.state);

    expect(getStdTransitionState(result.state)).toEqual({
      events: [{ sequence: 1, effect: "flash", durationMs: 180, color: "#ffffff" }],
      nextSequence: 2,
    });
  });

  it("round-trips through createRuntimeSnapshot and restoreRuntimeState", () => {
    const result = runStdTransitionCommands(
      command("transition", [positionalString("fade"), namedNumber("duration", 500), namedString("color", "#000000")]),
    );

    const saveReadyState = prepareStdTransitionStateForSnapshot(result.state);
    const snapshot = createRuntimeSnapshot(saveReadyState);
    const restored = restoreRuntimeState(snapshot);

    expect(getStdTransitionState(restored)).toEqual({
      events: [],
      nextSequence: 2,
    });
  });

  it("throws when stdTransition state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => prepareStdTransitionStateForSnapshot(state)).toThrow(
      "runtimeState.plugins.stdTransition is not initialized. Register createStdTransitionPlugin().",
    );
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-transition.tzr",
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

function runStdTransitionCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdTransitionPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdTransitionCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
