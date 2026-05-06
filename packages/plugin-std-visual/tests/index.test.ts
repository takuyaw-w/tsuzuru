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
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdVisualPlugin()],
    });

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
    expect(Object.keys(stdVisualPluginCommands)).toEqual(["bg", "show", "hide"]);
    expect(stdVisualPluginCommands.bg?.name).toBe("bg");
    expect(stdVisualPluginCommands.show?.name).toBe("show");
    expect(stdVisualPluginCommands.hide?.name).toBe("hide");
  });

  it("sets and overwrites the background with bg commands", () => {
    const result = runStdVisualCommands(
      command("bg", [positionalString("classroom")]),
      command("bg", [positionalString("street")]),
    );

    expect(getStdVisualState(result.state).background).toEqual({ assetId: "street" });
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

  it("updates and hides sprites", () => {
    const result = runStdVisualCommands(
      command("show", [positionalString("alice_smile"), namedString("position", "left")]),
      command("show", [positionalString("alice_smile"), namedString("position", "right")]),
      command("hide", [positionalString("alice_smile")]),
    );

    expect(getStdVisualState(result.state).sprites).toEqual({});
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
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-visual.tzr",
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

function namedString(name: string, value: string): TzrArgument {
  return {
    type: "NamedArgument",
    name,
    value: { type: "StringValue", value, loc },
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
