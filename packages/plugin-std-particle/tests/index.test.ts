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
  createStdParticleCommandHandlers,
  createStdParticlePlugin,
  getStdParticleState,
  stdParticlePluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-particle.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-particle.tzr", line: 1, column: 1 },
};

const initialParticleState = {
  current: null,
};

describe("createStdParticlePlugin", () => {
  it("initializes runtimeState.plugins.stdParticle", () => {
    const plugin = createStdParticlePlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdParticlePluginCommands);
    expect(state.plugins.stdParticle).toEqual(initialParticleState);
  });

  it("returns initialized stdParticle state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdParticlePlugin()],
    });

    expect(getStdParticleState(state)).toEqual(initialParticleState);
  });

  it("throws when stdParticle state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdParticleState(state)).toThrow(
      "runtimeState.plugins.stdParticle is not initialized. Register createStdParticlePlugin().",
    );
  });
});

describe("std-particle commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdParticlePluginCommands)).toEqual(["particle", "stopParticle"]);
    expect(stdParticlePluginCommands.particle).toEqual({
      name: "particle",
      args: {
        kind: "mixed",
        positional: [{ type: "string", values: ["rain", "snow", "sakura", "dust"] }],
        named: [{ name: "intensity", type: "string", optional: true, values: ["light", "normal", "strong"] }],
      },
    });
    expect(stdParticlePluginCommands.stopParticle).toEqual({
      name: "stopParticle",
      args: { kind: "none" },
    });
  });

  it("sets rain, snow, sakura, and dust particles", () => {
    expect(runStdParticleCommands(command("particle", [positionalString("rain")])).state.plugins.stdParticle).toEqual({
      current: { type: "rain", intensity: "normal" },
    });
    expect(runStdParticleCommands(command("particle", [positionalString("snow")])).state.plugins.stdParticle).toEqual({
      current: { type: "snow", intensity: "normal" },
    });
    expect(runStdParticleCommands(command("particle", [positionalString("sakura")])).state.plugins.stdParticle).toEqual(
      {
        current: { type: "sakura", intensity: "normal" },
      },
    );
    expect(runStdParticleCommands(command("particle", [positionalString("dust")])).state.plugins.stdParticle).toEqual({
      current: { type: "dust", intensity: "normal" },
    });
  });

  it("uses default intensity normal", () => {
    const result = runStdParticleCommands(command("particle", [positionalString("snow")]));

    expect(getStdParticleState(result.state)).toEqual({
      current: { type: "snow", intensity: "normal" },
    });
  });

  it("uses explicit intensity", () => {
    const result = runStdParticleCommands(
      command("particle", [positionalString("rain"), namedString("intensity", "strong")]),
    );

    expect(getStdParticleState(result.state)).toEqual({
      current: { type: "rain", intensity: "strong" },
    });
  });

  it("overwrites the current particle when repeated", () => {
    const result = runStdParticleCommands(
      command("particle", [positionalString("rain"), namedString("intensity", "strong")]),
      command("particle", [positionalString("dust"), namedString("intensity", "light")]),
    );

    expect(getStdParticleState(result.state)).toEqual({
      current: { type: "dust", intensity: "light" },
    });
  });

  it("stops particle", () => {
    const result = runStdParticleCommands(
      command("particle", [positionalString("sakura")]),
      command("stopParticle", []),
    );

    expect(getStdParticleState(result.state)).toEqual({ current: null });
  });

  it("treats stopParticle without current particle as no-op", () => {
    const result = runStdParticleCommands(command("stopParticle", []));

    expect(getStdParticleState(result.state)).toEqual({ current: null });
  });

  it("round-trips particle state through snapshot and restore", () => {
    const result = runStdParticleCommands(command("particle", [positionalString("snow")]));

    const restored = restoreRuntimeState(createRuntimeSnapshot(result.state));

    expect(getStdParticleState(restored)).toEqual({
      current: { type: "snow", intensity: "normal" },
    });
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() => runStdParticleCommands(command("particle", [positionalString("smoke")]))).toThrow(
      "Invalid @particle runtime arguments. Expected validated std particle command arguments.",
    );
    expect(() =>
      runStdParticleCommands(command("particle", [positionalString("rain"), namedString("intensity", "huge")])),
    ).toThrow("Invalid @particle runtime arguments. Expected validated std particle command arguments.");
    expect(() =>
      runStdParticleCommands(command("particle", [positionalString("rain"), positionalString("snow")])),
    ).toThrow("Invalid @particle runtime arguments. Expected validated std particle command arguments.");
    expect(() => runStdParticleCommands(command("stopParticle", [positionalString("rain")]))).toThrow(
      "Invalid @stopParticle runtime arguments. Expected validated std particle command arguments.",
    );
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-particle.tzr",
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

function runStdParticleCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdParticlePlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdParticleCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
