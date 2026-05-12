import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_CAMERA_PLUGIN_NAME = "stdCamera";
const STD_CAMERA_EASINGS = ["linear", "ease", "easeIn", "easeOut"] as const satisfies readonly StdCameraEasing[];

export type StdCameraEasing = "linear" | "ease" | "easeIn" | "easeOut";

export interface StdCameraTransition {
  readonly durationMs: number;
  readonly easing: StdCameraEasing;
}

export interface StdCameraState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly focusTarget: string | null;
  readonly transition: StdCameraTransition | null;
}

const STD_CAMERA_TRANSITION_NAMED_ARGS = [
  { name: "duration", type: "number", optional: true, integer: true, min: 0 },
  { name: "easing", type: "string", optional: true, values: STD_CAMERA_EASINGS },
] as const;

export const stdCameraPluginCommands = {
  camera: definePluginCommand("camera", {
    kind: "named",
    arguments: [
      { name: "x", type: "number", optional: true },
      { name: "y", type: "number", optional: true },
      { name: "zoom", type: "number", optional: true, min: 0 },
      ...STD_CAMERA_TRANSITION_NAMED_ARGS,
    ],
  }),
  cameraFocus: definePluginCommand("cameraFocus", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [{ name: "zoom", type: "number", optional: true, min: 0 }, ...STD_CAMERA_TRANSITION_NAMED_ARGS],
  }),
  resetCamera: definePluginCommand("resetCamera", {
    kind: "named",
    arguments: STD_CAMERA_TRANSITION_NAMED_ARGS,
  }),
} satisfies PluginCommandMap;

export function createStdCameraPlugin(): RuntimePluginDefinition<StdCameraState> {
  return {
    name: STD_CAMERA_PLUGIN_NAME,
    commands: stdCameraPluginCommands,
    createInitialState: createInitialStdCameraState,
  };
}

export function createStdCameraCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    camera: handleCamera,
    cameraFocus: handleCameraFocus,
    resetCamera: handleResetCamera,
  };
}

export function getStdCameraState(runtimeState: RuntimeState): StdCameraState {
  const state = runtimeState.plugins[STD_CAMERA_PLUGIN_NAME];
  if (!isStdCameraState(state)) {
    throw new Error("runtimeState.plugins.stdCamera is not initialized. Register createStdCameraPlugin().");
  }

  return state;
}

function handleCamera(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const current = getStdCameraState(state);
  const hasX = hasNamedArgument(instruction, "x");
  const hasY = hasNamedArgument(instruction, "y");
  const hasZoom = hasNamedArgument(instruction, "zoom");

  if (!hasX && !hasY && !hasZoom) {
    throwInvalidRuntimeArguments(instruction);
  }

  const zoom = getOptionalNamedNumber(instruction, "zoom") ?? current.zoom;
  assertPositiveZoom(instruction, zoom);

  return {
    state: withStdCameraState(state, {
      x: getOptionalNamedNumber(instruction, "x") ?? current.x,
      y: getOptionalNamedNumber(instruction, "y") ?? current.y,
      zoom,
      focusTarget: null,
      transition: getTransition(instruction, 0),
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleCameraFocus(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  const focusTarget = getRequiredPositionalString(instruction, 0);
  const zoom = getOptionalNamedNumber(instruction, "zoom") ?? 1.15;
  assertPositiveZoom(instruction, zoom);

  return {
    state: withStdCameraState(state, {
      x: 0,
      y: 0,
      zoom,
      focusTarget,
      transition: getTransition(instruction, 300),
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleResetCamera(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  return {
    state: withStdCameraState(state, {
      ...createInitialStdCameraState(),
      transition: getTransition(instruction, 0),
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function createInitialStdCameraState(): StdCameraState {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    focusTarget: null,
    transition: null,
  };
}

function withStdCameraState(state: RuntimeState, stdCamera: StdCameraState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_CAMERA_PLUGIN_NAME]: stdCamera,
    },
  };
}

function getTransition(instruction: CommandInstruction, defaultDurationMs: number): StdCameraTransition {
  const durationMs = getOptionalNamedNumber(instruction, "duration") ?? defaultDurationMs;
  const easing = getOptionalNamedString(instruction, "easing") ?? "ease";

  if (!Number.isInteger(durationMs) || durationMs < 0 || !isStdCameraEasing(easing)) {
    throwInvalidRuntimeArguments(instruction);
  }

  return { durationMs, easing };
}

function getRequiredPositionalString(instruction: CommandInstruction, index: number): string {
  const argument = instruction.args[index];
  if (
    argument?.type !== "PositionalArgument" ||
    argument.value.type !== "StringValue" ||
    argument.value.value.length === 0
  ) {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getOptionalNamedNumber(instruction: CommandInstruction, name: string): number | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument === undefined) {
    return undefined;
  }
  if (
    argument.type !== "NamedArgument" ||
    argument.value.type !== "NumberValue" ||
    !Number.isFinite(argument.value.value)
  ) {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getOptionalNamedString(instruction: CommandInstruction, name: string): string | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument === undefined) {
    return undefined;
  }
  if (argument.type !== "NamedArgument" || argument.value.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function hasNamedArgument(instruction: CommandInstruction, name: string): boolean {
  return instruction.args.some((arg) => arg.type === "NamedArgument" && arg.name === name);
}

function assertPositiveZoom(instruction: CommandInstruction, zoom: number): void {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throwInvalidRuntimeArguments(instruction);
  }
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std camera command arguments.`);
}

function isStdCameraState(value: unknown): value is StdCameraState {
  return (
    isObjectRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.zoom === "number" &&
    (typeof value.focusTarget === "string" || value.focusTarget === null) &&
    (value.transition === null || isStdCameraTransition(value.transition))
  );
}

function isStdCameraTransition(value: unknown): value is StdCameraTransition {
  return isObjectRecord(value) && typeof value.durationMs === "number" && isStdCameraEasing(value.easing);
}

function isStdCameraEasing(value: unknown): value is StdCameraEasing {
  return value === "linear" || value === "ease" || value === "easeIn" || value === "easeOut";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
