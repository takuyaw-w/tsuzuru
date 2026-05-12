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
  createStdCameraCommandHandlers,
  createStdCameraPlugin,
  getStdCameraState,
  stdCameraPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-camera.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-camera.tzr", line: 1, column: 1 },
};

const initialCameraState = {
  x: 0,
  y: 0,
  zoom: 1,
  focusTarget: null,
  transition: null,
};

describe("createStdCameraPlugin", () => {
  it("initializes runtimeState.plugins.stdCamera", () => {
    const plugin = createStdCameraPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdCameraPluginCommands);
    expect(state.plugins.stdCamera).toEqual(initialCameraState);
  });

  it("returns initialized stdCamera state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdCameraPlugin()],
    });

    expect(getStdCameraState(state)).toEqual(initialCameraState);
  });

  it("throws when stdCamera state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdCameraState(state)).toThrow(
      "runtimeState.plugins.stdCamera is not initialized. Register createStdCameraPlugin().",
    );
  });
});

describe("std-camera commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdCameraPluginCommands)).toEqual(["camera", "cameraFocus", "resetCamera"]);
    expect(stdCameraPluginCommands.camera).toEqual({
      name: "camera",
      args: {
        kind: "named",
        arguments: [
          { name: "x", type: "number", optional: true },
          { name: "y", type: "number", optional: true },
          { name: "zoom", type: "number", optional: true, min: 0 },
          { name: "duration", type: "number", optional: true, integer: true, min: 0 },
          { name: "easing", type: "string", optional: true, values: ["linear", "ease", "easeIn", "easeOut"] },
        ],
      },
    });
    expect(stdCameraPluginCommands.cameraFocus).toEqual({
      name: "cameraFocus",
      args: {
        kind: "mixed",
        positional: [{ type: "string", nonEmpty: true }],
        named: [
          { name: "zoom", type: "number", optional: true, min: 0 },
          { name: "duration", type: "number", optional: true, integer: true, min: 0 },
          { name: "easing", type: "string", optional: true, values: ["linear", "ease", "easeIn", "easeOut"] },
        ],
      },
    });
    expect(stdCameraPluginCommands.resetCamera).toEqual({
      name: "resetCamera",
      args: {
        kind: "named",
        arguments: [
          { name: "duration", type: "number", optional: true, integer: true, min: 0 },
          { name: "easing", type: "string", optional: true, values: ["linear", "ease", "easeIn", "easeOut"] },
        ],
      },
    });
  });

  it("updates x, y, and zoom", () => {
    const result = runStdCameraCommands(
      command("camera", [
        namedNumber("x", 80),
        namedNumber("y", -20),
        namedNumber("zoom", 1.15),
        namedNumber("duration", 500),
        namedString("easing", "easeOut"),
      ]),
    );

    expect(getStdCameraState(result.state)).toEqual({
      x: 80,
      y: -20,
      zoom: 1.15,
      focusTarget: null,
      transition: { durationMs: 500, easing: "easeOut" },
    });
  });

  it("keeps unspecified camera values on partial update", () => {
    const result = runStdCameraCommands(
      command("camera", [namedNumber("x", 80), namedNumber("y", -20), namedNumber("zoom", 1.15)]),
      command("camera", [namedNumber("zoom", 1.08), namedNumber("duration", 240)]),
    );

    expect(getStdCameraState(result.state)).toEqual({
      x: 80,
      y: -20,
      zoom: 1.08,
      focusTarget: null,
      transition: { durationMs: 240, easing: "ease" },
    });
  });

  it("sets camera focus with defaults", () => {
    const result = runStdCameraCommands(command("cameraFocus", [positionalString("tone_stand")]));

    expect(getStdCameraState(result.state)).toEqual({
      x: 0,
      y: 0,
      zoom: 1.15,
      focusTarget: "tone_stand",
      transition: { durationMs: 300, easing: "ease" },
    });
  });

  it("sets camera focus with explicit zoom, duration, and easing", () => {
    const result = runStdCameraCommands(
      command("cameraFocus", [
        positionalString("noize_stand"),
        namedNumber("zoom", 1.2),
        namedNumber("duration", 400),
        namedString("easing", "easeOut"),
      ]),
    );

    expect(getStdCameraState(result.state)).toEqual({
      x: 0,
      y: 0,
      zoom: 1.2,
      focusTarget: "noize_stand",
      transition: { durationMs: 400, easing: "easeOut" },
    });
  });

  it("resets camera while preserving reset transition", () => {
    const result = runStdCameraCommands(
      command("camera", [namedNumber("x", 80), namedNumber("y", -20), namedNumber("zoom", 1.15)]),
      command("resetCamera", [namedNumber("duration", 400)]),
    );

    expect(getStdCameraState(result.state)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
      focusTarget: null,
      transition: { durationMs: 400, easing: "ease" },
    });
  });

  it("defaults direct camera and reset transition duration and easing", () => {
    const direct = runStdCameraCommands(command("camera", [namedNumber("x", 12)]));
    const reset = runStdCameraCommands(command("resetCamera", []));

    expect(getStdCameraState(direct.state).transition).toEqual({ durationMs: 0, easing: "ease" });
    expect(getStdCameraState(reset.state).transition).toEqual({ durationMs: 0, easing: "ease" });
  });

  it("round-trips camera state through snapshot and restore", () => {
    const result = runStdCameraCommands(
      command("cameraFocus", [positionalString("mix_stand"), namedNumber("zoom", 1.18)]),
    );

    const restored = restoreRuntimeState(createRuntimeSnapshot(result.state));

    expect(getStdCameraState(restored)).toEqual({
      x: 0,
      y: 0,
      zoom: 1.18,
      focusTarget: "mix_stand",
      transition: { durationMs: 300, easing: "ease" },
    });
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() => runStdCameraCommands(command("camera", []))).toThrow(
      "Invalid @camera runtime arguments. Expected validated std camera command arguments.",
    );
    expect(() => runStdCameraCommands(command("camera", [namedNumber("zoom", 0)]))).toThrow(
      "Invalid @camera runtime arguments. Expected validated std camera command arguments.",
    );
    expect(() => runStdCameraCommands(command("camera", [namedNumber("x", 0), namedNumber("duration", -1)]))).toThrow(
      "Invalid @camera runtime arguments. Expected validated std camera command arguments.",
    );
    expect(() =>
      runStdCameraCommands(command("cameraFocus", [positionalString("tone_stand"), namedString("easing", "bounce")])),
    ).toThrow("Invalid @cameraFocus runtime arguments. Expected validated std camera command arguments.");
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-camera.tzr",
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

function runStdCameraCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdCameraPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdCameraCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
