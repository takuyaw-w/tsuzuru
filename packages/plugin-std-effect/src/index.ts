import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_EFFECT_PLUGIN_NAME = "stdEffect";
const STD_EFFECT_TARGETS = ["screen", "message", "sprites"] as const satisfies readonly StdEffectTarget[];
const STD_EFFECT_INTENSITIES = ["light", "normal", "strong"] as const satisfies readonly StdEffectIntensity[];
const STD_EFFECT_HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export type StdEffectTarget = "screen" | "message" | "sprites";
export type StdEffectIntensity = "light" | "normal" | "strong";

export interface StdEffectShakeEvent {
  readonly sequence: number;
  readonly type: "shake";
  readonly target: StdEffectTarget;
  readonly intensity: StdEffectIntensity;
  readonly durationMs: number;
}

export interface StdEffectFlashEvent {
  readonly sequence: number;
  readonly type: "flash";
  readonly color: string;
  readonly durationMs: number;
}

export interface StdEffectPulseEvent {
  readonly sequence: number;
  readonly type: "pulse";
  readonly target: StdEffectTarget;
  readonly intensity: StdEffectIntensity;
  readonly durationMs: number;
}

export interface StdEffectBlurEvent {
  readonly sequence: number;
  readonly type: "blur";
  readonly target: "screen";
  readonly amount: number;
  readonly durationMs: number;
}

export type StdEffectEvent = StdEffectShakeEvent | StdEffectFlashEvent | StdEffectPulseEvent | StdEffectBlurEvent;

export interface StdEffectState {
  readonly events: readonly StdEffectEvent[];
  readonly nextSequence: number;
}

const STD_EFFECT_TARGET_POSITIONAL_ARG = [{ type: "string", values: STD_EFFECT_TARGETS }] as const;
const STD_EFFECT_SCREEN_TARGET_POSITIONAL_ARG = [{ type: "string", values: ["screen"] }] as const;
const STD_EFFECT_INTENSITY_DURATION_NAMED_ARGS = [
  { name: "intensity", type: "string", optional: true, values: STD_EFFECT_INTENSITIES },
  { name: "duration", type: "number", integer: true, min: 0 },
] as const;

export const stdEffectPluginCommands = {
  shake: definePluginCommand("shake", {
    kind: "mixed",
    positional: STD_EFFECT_TARGET_POSITIONAL_ARG,
    named: STD_EFFECT_INTENSITY_DURATION_NAMED_ARGS,
  }),
  flash: definePluginCommand("flash", {
    kind: "named",
    arguments: [
      { name: "color", type: "string", nonEmpty: true },
      { name: "duration", type: "number", integer: true, min: 0 },
    ],
  }),
  pulse: definePluginCommand("pulse", {
    kind: "mixed",
    positional: STD_EFFECT_TARGET_POSITIONAL_ARG,
    named: STD_EFFECT_INTENSITY_DURATION_NAMED_ARGS,
  }),
  blur: definePluginCommand("blur", {
    kind: "mixed",
    positional: STD_EFFECT_SCREEN_TARGET_POSITIONAL_ARG,
    named: [
      { name: "amount", type: "number", min: 0 },
      { name: "duration", type: "number", integer: true, min: 0 },
    ],
  }),
} satisfies PluginCommandMap;

export function createStdEffectPlugin(): RuntimePluginDefinition<StdEffectState> {
  return {
    name: STD_EFFECT_PLUGIN_NAME,
    commands: stdEffectPluginCommands,
    createInitialState: createInitialStdEffectState,
  };
}

export function createStdEffectCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    shake: handleShake,
    flash: handleFlash,
    pulse: handlePulse,
    blur: handleBlur,
  };
}

export function getStdEffectState(runtimeState: RuntimeState): StdEffectState {
  const state = runtimeState.plugins[STD_EFFECT_PLUGIN_NAME];
  if (!isStdEffectState(state)) {
    throw new Error("runtimeState.plugins.stdEffect is not initialized. Register createStdEffectPlugin().");
  }

  return state;
}

export function prepareStdEffectStateForSnapshot(runtimeState: RuntimeState): RuntimeState {
  const current = getStdEffectState(runtimeState);

  return withStdEffectState(runtimeState, {
    events: [],
    nextSequence: current.nextSequence,
  });
}

function handleShake(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const current = getStdEffectState(state);
  const target = getRequiredTarget(instruction);
  const intensity = getOptionalIntensity(instruction) ?? "normal";
  const durationMs = getRequiredDuration(instruction);

  return appendStdEffectEvent(state, current, {
    sequence: current.nextSequence,
    type: "shake",
    target,
    intensity,
    durationMs,
  });
}

function handleFlash(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const current = getStdEffectState(state);
  const color = getRequiredFlashColor(instruction);
  const durationMs = getRequiredDuration(instruction);

  return appendStdEffectEvent(state, current, {
    sequence: current.nextSequence,
    type: "flash",
    color,
    durationMs,
  });
}

function handlePulse(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const current = getStdEffectState(state);
  const target = getRequiredTarget(instruction);
  const intensity = getOptionalIntensity(instruction) ?? "normal";
  const durationMs = getRequiredDuration(instruction);

  return appendStdEffectEvent(state, current, {
    sequence: current.nextSequence,
    type: "pulse",
    target,
    intensity,
    durationMs,
  });
}

function handleBlur(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const current = getStdEffectState(state);
  const target = getRequiredScreenTarget(instruction);
  const amount = getRequiredAmount(instruction);
  const durationMs = getRequiredDuration(instruction);

  return appendStdEffectEvent(state, current, {
    sequence: current.nextSequence,
    type: "blur",
    target,
    amount,
    durationMs,
  });
}

function appendStdEffectEvent(
  state: RuntimeState,
  current: StdEffectState,
  event: StdEffectEvent,
): ReturnType<RuntimePluginCommandHandler> {
  return {
    state: withStdEffectState(state, {
      events: [...current.events, event],
      nextSequence: current.nextSequence + 1,
    }),
    event: { type: "pluginCommand", name: event.type },
  };
}

function createInitialStdEffectState(): StdEffectState {
  return {
    events: [],
    nextSequence: 1,
  };
}

function withStdEffectState(state: RuntimeState, stdEffect: StdEffectState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_EFFECT_PLUGIN_NAME]: stdEffect,
    },
  };
}

function getRequiredTarget(instruction: CommandInstruction): StdEffectTarget {
  const value = getRequiredPositionalString(instruction, 0);
  if (!isStdEffectTarget(value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getRequiredScreenTarget(instruction: CommandInstruction): "screen" {
  const value = getRequiredPositionalString(instruction, 0);
  if (value !== "screen") {
    throwInvalidRuntimeArguments(instruction);
  }
  return "screen";
}

function getOptionalIntensity(instruction: CommandInstruction): StdEffectIntensity | undefined {
  const value = getOptionalNamedString(instruction, "intensity");
  if (value === undefined) {
    return undefined;
  }
  if (!isStdEffectIntensity(value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getRequiredDuration(instruction: CommandInstruction): number {
  const value = getRequiredNamedNumber(instruction, "duration");
  if (!Number.isInteger(value) || value < 0) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getRequiredAmount(instruction: CommandInstruction): number {
  const value = getRequiredNamedNumber(instruction, "amount");
  if (!Number.isFinite(value) || value < 0) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getRequiredFlashColor(instruction: CommandInstruction): string {
  const value = getRequiredNamedString(instruction, "color");
  if (!STD_EFFECT_HEX_COLOR_PATTERN.test(value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getRequiredPositionalString(instruction: CommandInstruction, index: number): string {
  const argument = instruction.args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getRequiredNamedString(instruction: CommandInstruction, name: string): string {
  const value = getOptionalNamedString(instruction, name);
  if (value === undefined) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
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

function getRequiredNamedNumber(instruction: CommandInstruction, name: string): number {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument?.type !== "NamedArgument" || argument.value.type !== "NumberValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std effect command arguments.`);
}

function isStdEffectState(value: unknown): value is StdEffectState {
  return (
    isObjectRecord(value) &&
    Array.isArray(value.events) &&
    value.events.every(isStdEffectEvent) &&
    typeof value.nextSequence === "number"
  );
}

function isStdEffectEvent(value: unknown): value is StdEffectEvent {
  if (!isObjectRecord(value) || typeof value.sequence !== "number" || typeof value.durationMs !== "number") {
    return false;
  }

  switch (value.type) {
    case "shake":
    case "pulse":
      return isStdEffectTarget(value.target) && isStdEffectIntensity(value.intensity);
    case "flash":
      return typeof value.color === "string";
    case "blur":
      return value.target === "screen" && typeof value.amount === "number";
    default:
      return false;
  }
}

function isStdEffectTarget(value: unknown): value is StdEffectTarget {
  return value === "screen" || value === "message" || value === "sprites";
}

function isStdEffectIntensity(value: unknown): value is StdEffectIntensity {
  return value === "light" || value === "normal" || value === "strong";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
