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
  createStdHotspotCommandHandlers,
  createStdHotspotPlugin,
  getStdHotspotState,
  resolveStdHotspotAction,
  stdHotspotPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-hotspot.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-hotspot.tzr", line: 1, column: 1 },
};

const initialHotspotState = {
  hotspots: {},
  waiting: false,
};

describe("createStdHotspotPlugin", () => {
  it("initializes runtimeState.plugins.stdHotspot", () => {
    const plugin = createStdHotspotPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdHotspotPluginCommands);
    expect(state.plugins.stdHotspot).toEqual(initialHotspotState);
  });

  it("returns initialized stdHotspot state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdHotspotPlugin()],
    });

    expect(getStdHotspotState(state)).toEqual(initialHotspotState);
  });

  it("throws when stdHotspot state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdHotspotState(state)).toThrow(
      "runtimeState.plugins.stdHotspot is not initialized. Register createStdHotspotPlugin().",
    );
  });
});

describe("std-hotspot commands", () => {
  it("keeps plugin command metadata available for DSL v2 integrations", () => {
    expect(Object.keys(stdHotspotPluginCommands)).toEqual(["hotspot", "waitHotspot", "clearHotspots"]);
    expect(stdHotspotPluginCommands.hotspot).toMatchObject({
      name: "hotspot",
      args: {
        kind: "mixed",
        positional: [{ type: "string", nonEmpty: true }],
        named: [
          { name: "x", type: "number", min: 0 },
          { name: "y", type: "number", min: 0 },
          { name: "width", type: "number", min: 0 },
          { name: "height", type: "number", min: 0 },
          { name: "target", type: "string", nonEmpty: true },
        ],
      },
    });
  });

  it("registers a hotspot", () => {
    const result = runStdHotspotCommands(hotspotCommand("desk", 160, 260, 220, 120, "inspect_desk"));

    expect(getStdHotspotState(result.state)).toEqual({
      hotspots: {
        desk: {
          shape: { type: "rect", x: 160, y: 260, width: 220, height: 120 },
          action: { type: "jump", target: "inspect_desk" },
        },
      },
      waiting: false,
    });
  });

  it("overwrites a hotspot with the same id", () => {
    const result = runStdHotspotCommands(
      hotspotCommand("desk", 160, 260, 220, 120, "inspect_desk"),
      hotspotCommand("desk", 120, 240, 260, 140, "inspect_notebook"),
    );

    expect(getStdHotspotState(result.state).hotspots.desk).toEqual({
      shape: { type: "rect", x: 120, y: 240, width: 260, height: 140 },
      action: { type: "jump", target: "inspect_notebook" },
    });
  });

  it("sets waiting true and blocks runtime on waitHotspot", () => {
    const result = runStdHotspotCommands(command("waitHotspot", []));

    expect(getStdHotspotState(result.state).waiting).toBe(true);
    expect(result.state.isWaitingForClick).toBe(true);
  });

  it("clears hotspots and waiting state", () => {
    const result = runStdHotspotCommands(
      hotspotCommand("desk", 160, 260, 220, 120, "inspect_desk"),
      command("waitHotspot", []),
    );
    const handler = createStdHotspotCommandHandlers().clearHotspots;
    if (handler === undefined) {
      throw new Error("missing clearHotspots handler");
    }
    const cleared = handler(result.state, command("clearHotspots", []), { warn: () => undefined });

    expect(getStdHotspotState(cleared.state)).toEqual(initialHotspotState);
    expect(cleared.state.isWaitingForClick).toBe(false);
  });

  it("resolves a clicked hotspot action by clearing waiting but retaining hotspots", () => {
    const result = runStdHotspotCommands(
      hotspotCommand("desk", 160, 260, 220, 120, "inspect_desk"),
      command("waitHotspot", []),
    );

    const resolved = resolveStdHotspotAction(result.state, "desk");

    expect(resolved.action).toEqual({ type: "jump", target: "inspect_desk" });
    expect(getStdHotspotState(resolved.state)).toEqual({
      ...getStdHotspotState(result.state),
      waiting: false,
    });
    expect(resolved.state.isWaitingForClick).toBe(false);
  });

  it("round-trips hotspot state through snapshot and restore", () => {
    const result = runStdHotspotCommands(hotspotCommand("door", 720, 180, 120, 360, "hallway"));

    const restored = restoreRuntimeState(createRuntimeSnapshot(result.state));

    expect(getStdHotspotState(restored)).toEqual(getStdHotspotState(result.state));
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() => runStdHotspotCommands(hotspotCommand("", 160, 260, 220, 120, "inspect_desk"))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(hotspotCommand("desk", -1, 260, 220, 120, "inspect_desk"))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(hotspotCommand("desk", 160, -1, 220, 120, "inspect_desk"))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(hotspotCommand("desk", 160, 260, 0, 120, "inspect_desk"))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(hotspotCommand("desk", 160, 260, 220, 0, "inspect_desk"))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(hotspotCommand("desk", 160, 260, 220, 120, ""))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(command("hotspot", [positionalString("desk")]))).toThrow(
      "Invalid @hotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
    expect(() => runStdHotspotCommands(command("waitHotspot", [positionalString("desk")]))).toThrow(
      "Invalid @waitHotspot runtime arguments. Expected validated std hotspot command arguments.",
    );
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-hotspot.tzr",
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

function hotspotCommand(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  target: string,
): CommandInstruction {
  return command("hotspot", [
    positionalString(id),
    namedNumber("x", x),
    namedNumber("y", y),
    namedNumber("width", width),
    namedNumber("height", height),
    namedString("target", target),
  ]);
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

function runStdHotspotCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdHotspotPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdHotspotCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
