import {
  type CommandInstruction,
  createInitialRuntimeState,
  type RuntimeDocument,
  stepRuntime,
  type TzrArgument,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
  getStdVisualState,
  stdVisualPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-visual.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-visual.tzr", line: 1, column: 1 },
};

describe("createStdVisualPlugin", () => {
  it("initializes runtimeState.plugins.stdVisual", () => {
    const plugin = createStdVisualPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdVisualPluginCommands);
    expect(state.plugins.stdVisual).toEqual({
      background: null,
      sprites: {},
    });
    expect(getStdVisualState(state)).toEqual({
      background: null,
      sprites: {},
    });
  });

  it("throws when stdVisual state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdVisualState(state)).toThrow(
      "runtimeState.plugins.stdVisual is not initialized. Register createStdVisualPlugin().",
    );
  });
});

describe("std-visual commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdVisualPluginCommands)).toEqual(["bg", "show", "hide", "clearBg", "clearSprites"]);
    expect(stdVisualPluginCommands.bg).toEqual({
      name: "bg",
      args: {
        kind: "mixed",
        positional: [{ type: "string", nonEmpty: true }],
        named: [
          {
            name: "transition",
            type: "string",
            optional: true,
            values: ["fade", "pageTurn", "blurFade", "slide"],
          },
          {
            name: "duration",
            type: "number",
            optional: true,
            integer: true,
            min: 1,
            requiredWith: ["transition"],
          },
          {
            name: "direction",
            type: "string",
            optional: true,
            values: ["left", "right", "up", "down"],
            requiredWith: ["transition"],
          },
          {
            name: "color",
            type: "string",
            optional: true,
            requiredWith: ["transition"],
          },
        ],
      },
    });
    expect(stdVisualPluginCommands.show).toEqual({
      name: "show",
      args: {
        kind: "mixed",
        positional: [{ type: "string", nonEmpty: true }],
        named: [
          { name: "position", type: "string", optional: true, values: ["left", "center", "right"] },
          {
            name: "transition",
            type: "string",
            optional: true,
            values: ["fade", "dissolve"],
            requiredWith: ["duration"],
          },
          {
            name: "duration",
            type: "number",
            optional: true,
            integer: true,
            min: 0,
            requiredWith: ["transition"],
          },
        ],
      },
    });
    expect(stdVisualPluginCommands.hide).toEqual({
      name: "hide",
      args: {
        kind: "mixed",
        positional: [{ type: "string", nonEmpty: true }],
        named: [
          {
            name: "transition",
            type: "string",
            optional: true,
            values: ["fade", "dissolve"],
            requiredWith: ["duration"],
          },
          {
            name: "duration",
            type: "number",
            optional: true,
            integer: true,
            min: 0,
            requiredWith: ["transition"],
          },
        ],
      },
    });
    expect(stdVisualPluginCommands.clearBg).toEqual({
      name: "clearBg",
      args: {
        kind: "named",
        arguments: [
          {
            name: "transition",
            type: "string",
            optional: true,
            values: ["fade", "dissolve"],
            requiredWith: ["duration"],
          },
          {
            name: "duration",
            type: "number",
            optional: true,
            integer: true,
            min: 0,
            requiredWith: ["transition"],
          },
        ],
      },
    });
    expect(stdVisualPluginCommands.clearSprites).toEqual({
      name: "clearSprites",
      args: {
        kind: "named",
        arguments: [
          {
            name: "transition",
            type: "string",
            optional: true,
            values: ["fade", "dissolve"],
            requiredWith: ["duration"],
          },
          {
            name: "duration",
            type: "number",
            optional: true,
            integer: true,
            min: 0,
            requiredWith: ["transition"],
          },
        ],
      },
    });
  });

  it("sets and overwrites the background with bg commands", () => {
    const result = runStdVisualCommands(
      command("bg", [positionalString("classroom")]),
      command("bg", [positionalString("street")]),
    );

    expect(getStdVisualState(result.state).background).toEqual({ assetId: "street" });
  });

  it("stores transition metadata on backgrounds", () => {
    const result = runStdVisualCommands(
      command("bg", [
        positionalString("classroom"),
        namedString("transition", "pageTurn"),
        namedNumber("duration", 800),
        namedString("direction", "right"),
      ]),
    );

    expect(getStdVisualState(result.state).background).toEqual({
      assetId: "classroom",
      transition: { effect: "pageTurn", durationMs: 800, direction: "right", color: "#ffffff" },
    });
  });

  it("applies background transition defaults", () => {
    const result = runStdVisualCommands(
      command("bg", [positionalString("library"), namedString("transition", "fade")]),
    );

    expect(getStdVisualState(result.state).background).toEqual({
      assetId: "library",
      transition: { effect: "fade", durationMs: 500, color: "#000000" },
    });
  });

  it("shows sprites at default and named positions", () => {
    const result = runStdVisualCommands(
      command("show", [positionalString("alice_smile")]),
      command("show", [positionalString("yu_smile"), namedString("position", "left")]),
    );

    expect(getStdVisualState(result.state).sprites).toEqual({
      alice_smile: { position: "center" },
      yu_smile: { position: "left" },
    });
  });

  it("stores transition metadata on shown sprites", () => {
    const result = runStdVisualCommands(
      command("show", [
        positionalString("alice_smile"),
        namedString("position", "right"),
        namedString("transition", "dissolve"),
        namedNumber("duration", 250),
      ]),
    );

    expect(getStdVisualState(result.state).sprites).toEqual({
      alice_smile: {
        position: "right",
        transition: { type: "dissolve", durationMs: 250 },
      },
    });
  });

  it("updates and hides sprites", () => {
    const result = runStdVisualCommands(
      command("show", [positionalString("alice_smile"), namedString("position", "left")]),
      command("show", [positionalString("alice_smile"), namedString("position", "right")]),
      command("hide", [positionalString("alice_smile")]),
    );

    expect(getStdVisualState(result.state).sprites).toEqual({});
  });

  it("clears the background while preserving sprites", () => {
    const result = runStdVisualCommands(
      command("bg", [positionalString("classroom")]),
      command("show", [positionalString("alice_smile"), namedString("position", "left")]),
      command("clearBg", []),
    );

    expect(getStdVisualState(result.state)).toEqual({
      background: null,
      sprites: {
        alice_smile: { position: "left" },
      },
    });
  });

  it("keeps clearBg a no-op when the background is already null", () => {
    const result = runStdVisualCommands(command("clearBg", []));

    expect(getStdVisualState(result.state)).toEqual({
      background: null,
      sprites: {},
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("clears all sprites while preserving the background", () => {
    const result = runStdVisualCommands(
      command("bg", [positionalString("classroom")]),
      command("show", [positionalString("alice_smile"), namedString("position", "left")]),
      command("show", [positionalString("yu_smile"), namedString("position", "right")]),
      command("clearSprites", []),
    );

    expect(getStdVisualState(result.state)).toEqual({
      background: { assetId: "classroom" },
      sprites: {},
    });
  });

  it("keeps clearSprites a no-op when sprites are already empty", () => {
    const result = runStdVisualCommands(command("clearSprites", []));

    expect(getStdVisualState(result.state)).toEqual({
      background: null,
      sprites: {},
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("accepts transition metadata on destructive operations without persisting it", () => {
    const result = runStdVisualCommands(
      command("bg", [positionalString("classroom")]),
      command("show", [positionalString("alice_smile")]),
      command("hide", [
        positionalString("alice_smile"),
        namedString("transition", "fade"),
        namedNumber("duration", 100),
      ]),
      command("clearBg", [namedString("transition", "dissolve"), namedNumber("duration", 0)]),
      command("clearSprites", [namedString("transition", "fade"), namedNumber("duration", 50)]),
    );

    expect(getStdVisualState(result.state)).toEqual({
      background: null,
      sprites: {},
    });
  });

  it("emits a runtime warning when hiding a missing sprite", () => {
    const result = runStdVisualCommands(command("hide", [positionalString("missing")]));

    expect(getStdVisualState(result.state).sprites).toEqual({});
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        code: "plugin.stdVisual.hideTargetNotFound",
        message: 'Cannot hide "missing" because it is not visible.',
      },
    ]);
  });

  it("throws on invalid runtime arguments after legacy compile-time validation removal", () => {
    expect(() => runStdVisualCommands(command("bg", [positionalString("")]))).toThrow(
      "Invalid @bg runtime arguments. Expected validated std visual command arguments.",
    );
    expect(() =>
      runStdVisualCommands(command("show", [positionalString("alice"), namedString("position", "top")])),
    ).toThrow("Invalid @show runtime arguments. Expected validated std visual command arguments.");
    expect(() =>
      runStdVisualCommands(command("bg", [positionalString("classroom"), namedString("transition", "dissolve")])),
    ).toThrow("Invalid @bg runtime arguments. Expected validated std visual command arguments.");
    expect(() =>
      runStdVisualCommands(
        command("bg", [
          positionalString("classroom"),
          namedString("transition", "pageTurn"),
          namedString("direction", "up"),
        ]),
      ),
    ).toThrow("Invalid @bg runtime arguments. Expected validated std visual command arguments.");
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-visual.tzr",
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

function runStdVisualCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  const diagnostics: Array<{ readonly severity: "warning"; readonly code: string; readonly message: string }> = [];
  let state = createInitialRuntimeState(document, {
    plugins: [createStdVisualPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdVisualCommandHandlers(),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    state = result.state;
  }

  return { state, diagnostics };
}
